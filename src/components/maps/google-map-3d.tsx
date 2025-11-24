"use client";

import { useState, useCallback, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Map3D, Map3DCameraProps } from '../map-3d';
import { NetworkOverlay } from './network-overlay';
import { WidthLabels } from './width-labels';

export interface MapState {
  baseNetwork: string;
  overlays: string[];
}

interface GoogleMap3DProps {
  className?: string;
  onMapLoad?: (map: google.maps.Map) => void;
  mapState: MapState;
  cameraPosition?: Map3DCameraProps;
  onCameraReady?: (updateCamera: (props: Map3DCameraProps) => void) => void;
}

interface LaneFeature {
  type: string;
  properties: {
    width?: number;
    street_id?: string;
    lane_type_code?: string;
    color?: string;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

interface LaneGeoJSON {
  type: string;
  features: LaneFeature[];
}

// Central Zürich - parking location view (focused on parking area)
const CENTRAL_ZURICH = {
  lat: 47.388,  // Adjusted to center on parking spots
  lng: 8.548,   // Adjusted to center on parking spots
  altitude: 0
};

// Initial camera position for photorealistic 3D view - zoomed in for parking visibility
const INITIAL_CAMERA_PROPS: Map3DCameraProps = {
  center: CENTRAL_ZURICH,
  range: 300, // Much closer - street level view for parking spot visibility
  heading: 25, // Slight rotation for better building visibility
  tilt: 45, // Increased tilt for better 3D parking spot visibility
  roll: 0
};


export function GoogleMap3D({
  className = "",
  mapState,
  cameraPosition,
  onCameraReady
}: GoogleMap3DProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraProps, setCameraProps] = useState<Map3DCameraProps>(INITIAL_CAMERA_PROPS);
  const [lanes, setLanes] = useState<LaneFeature[]>([]);
  const [overlayLayers, setOverlayLayers] = useState<Record<string, LaneFeature[]>>({});
  const [showNetwork, setShowNetwork] = useState(true);


  // Fetch base network AND overlay data from API (combined loading)
  useEffect(() => {
    console.log('📊 Loading network data...');

    // Load base network
    fetch(`/api/network-data?type=lanes&map=${mapState.baseNetwork}&t=` + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then(res => res.json())
      .then((data: LaneGeoJSON) => {
        // Add color to base network features (curbs should be white/gray)
        const featuresWithColor = data.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            color: feature.properties.color || (mapState.baseNetwork.includes('curbs') ? '#DDDDDD' : undefined)
          }
        }));
        setLanes(featuresWithColor);
        console.log(`✅ Loaded ${data.features.length} lanes from base network: ${mapState.baseNetwork}`);
      })
      .catch(err => {
        console.error('Failed to load base network:', err);
        setError('Failed to load network data');
      });

    // Load overlays using the same API endpoint
    if (mapState.overlays && mapState.overlays.length > 0) {
      console.log('📥 Loading overlays:', mapState.overlays);

      const overlayPromises = mapState.overlays.map(async (overlayName) => {
        try {
          console.log(`  📡 Fetching: /api/network-data?map=${overlayName}`);

          const response = await fetch(`/api/network-data?map=${overlayName}&t=` + Date.now(), {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });

          const data: LaneGeoJSON = await response.json();
          console.log(`  ✅ Loaded ${data.features.length} features from overlay: ${overlayName}`);

          // DEBUG: Check what we actually received
          if (data.features.length > 0) {
            console.log(`     First feature for ${overlayName}:`);
            console.log(`       - Geometry type: ${data.features[0].geometry.type}`);
            console.log(`       - Object type: ${data.features[0].properties.object_type}`);
            console.log(`       - Feature type: ${data.features[0].properties.feature_type}`);
          }

          // Add color to overlay features based on overlay type
          const overlayColor = overlayName.includes('parking_spots') ? '#00F0FF'  // Neon Cyan for parking spots
                             : overlayName.includes('remaining_roadway') ? '#FF6600'  // Bright orange for roadway width
                             : undefined;

          const featuresWithColor = data.features.map(feature => ({
            ...feature,
            properties: {
              ...feature.properties,
              color: feature.properties.color || overlayColor,
              stroke_width: overlayName.includes('parking_spots') ? 3 : 2,
              fill_opacity: overlayName.includes('parking_spots') ? 0.7 : undefined,
              stroke_color: overlayName.includes('parking_spots') ? '#00D4E6' : undefined
            }
          }));

          return { name: overlayName, features: featuresWithColor };
        } catch (err) {
          console.error(`❌ Failed to load overlay ${overlayName}:`, err);
          return null;
        }
      });

      Promise.all(overlayPromises).then(results => {
        const newOverlays: Record<string, LaneFeature[]> = {};
        results.forEach(result => {
          if (result) {
            newOverlays[result.name] = result.features;
          }
        });
        console.log('📦 Setting overlay layers with keys:', Object.keys(newOverlays));
        setOverlayLayers(newOverlays);
      });
    } else {
      setOverlayLayers({});
    }
  }, [mapState.baseNetwork, JSON.stringify(mapState.overlays)]);


  const handleCameraChange = useCallback((props: Map3DCameraProps) => {
    setCameraProps(props);

    // Clear loading state when map starts responding to camera changes
    if (isLoading) {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Update camera when external position changes
  useEffect(() => {
    if (cameraPosition) {
      setCameraProps(cameraPosition);
    }
  }, [cameraPosition]);

  // Expose camera update function to parent
  useEffect(() => {
    if (onCameraReady) {
      const updateCamera = (props: Map3DCameraProps) => {
        setCameraProps(props);
      };
      onCameraReady(updateCamera);
    }
  }, [onCameraReady]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${className}`}>
        <div className="rounded-xl bg-black border border-red-500/20 p-8 text-center">
          <div className="mb-4 text-red-400">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Map Configuration Error</h3>
          <p className="text-sm text-gray-400 max-w-md">Google Maps API key not found</p>
          <p className="text-xs text-gray-500 mt-2">
            Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${className}`}>
        <div className="rounded-xl bg-black border border-red-500/20 p-8 text-center">
          <div className="mb-4 text-red-400">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Map Loading Error</h3>
          <p className="text-sm text-gray-400 max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p className="text-sm text-gray-300">Loading Photorealistic 3D Map...</p>
            <p className="text-xs text-gray-400 mt-1">Zürich</p>
          </div>
        </div>
      )}

      {/* Network Toggle Button */}
      {(lanes.length > 0 || Object.keys(overlayLayers).length > 0) && (
        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={() => setShowNetwork(!showNetwork)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              showNetwork
                ? 'bg-secondary text-black hover:bg-secondary/90'
                : 'bg-black/80 text-white border border-white/20 hover:bg-black/90'
            }`}
          >
            {showNetwork ? 'Hide' : 'Show'} Network
          </button>
        </div>
      )}

      {/* Official Map3D Component with Photorealistic 3D */}
      <APIProvider apiKey={apiKey}>
        <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
          <Map3D
            {...cameraProps}
            onCameraChange={handleCameraChange}
          />

          {/* Render base network lanes */}
          <NetworkOverlay lanes={lanes} visible={showNetwork} />

          {/* Render overlay layers (parking, charging stations, etc.) */}
          {Object.entries(overlayLayers).map(([layerName, features]) => (
            <NetworkOverlay
              key={layerName}
              lanes={features}
              visible={showNetwork}
            />
          ))}

          {/* Render width measurement labels */}
          {Object.entries(overlayLayers).map(([layerName, features]) => {
            // Only render labels for width measurement layers
            if (layerName.includes('remaining_roadway_width')) {
              return (
                <WidthLabels
                  key={`${layerName}-labels`}
                  features={features}
                  visible={showNetwork}
                />
              );
            }
            return null;
          })}
        </div>
      </APIProvider>
    </div>
  );
}