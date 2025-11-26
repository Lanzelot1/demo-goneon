"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Map,
  Layers,
  BarChart3,
  Car,
  Navigation,
  TreePine,
  Activity
} from "lucide-react";
import { GoogleMap3D } from "./google-map-3d";
import { FloatingParticles } from "@/components/FloatingParticles";

export interface MapState {
  baseNetwork: string;
  overlays: string[];
  timestamp?: number;
}

interface NetworkStats {
  streets: number;
  lanes: number;
  intersections: number;
  totalKm: number;
  laneTypes: {
    motor: number;
    transit: number;
    bicycle: number;
    green: number;
  };
}

const MOCK_STATS: NetworkStats = {
  streets: 2709,
  lanes: 5418,
  intersections: 1342,
  totalKm: 54.18,
  laneTypes: {
    motor: 3793,
    transit: 812,
    bicycle: 541,
    green: 272
  }
};

interface MapWidgetProps {
  mapState: MapState;
  overlayData?: any;
  onCameraReady?: (updateCamera: (props: any) => void) => void;
}

export function MapWidget({ mapState, overlayData, onCameraReady }: MapWidgetProps) {
  const [showStats, setShowStats] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeLayers, setActiveLayers] = useState({
    streets: true,
    lanes: true,
    intersections: true,
    busLanes: false,
    bikeLanes: false,
    greenLanes: false
  });
  const [showParticles, setShowParticles] = useState(false);
  const prevMapStateRef = React.useRef<string>('');

  // Serialize mapState for comparison
  const mapStateKey = `${mapState.baseNetwork}|${mapState.overlays.join(',')}`;

  console.log('🎯 Component render - showParticles:', showParticles, 'mapState:', mapStateKey);

  // Detect map updates and show particles animation
  useEffect(() => {
    console.log('🔍 Map change detected:', { prev: prevMapStateRef.current, current: mapStateKey });

    // Only show particles if map actually changed (not initial load)
    if (prevMapStateRef.current !== mapStateKey && prevMapStateRef.current !== '') {
      console.log('🎨 Map updated! Showing particles effect...', mapStateKey);
      setShowParticles(true);

      // Hide particles after 5 seconds (+ 1 second fade out = 6 seconds total)
      const timer = setTimeout(() => {
        console.log('🎨 Fading out particles effect');
        setShowParticles(false);
      }, 5000);

      prevMapStateRef.current = mapStateKey;
      return () => clearTimeout(timer);
    }

    prevMapStateRef.current = mapStateKey;
  }, [mapStateKey]);

  const toggleLayer = (layer: keyof typeof activeLayers) => {
    setActiveLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));

    // TODO: Implement actual layer toggling when we add street network overlays
    console.log(`Toggled layer: ${layer}`, activeLayers[layer]);
  };

  const handleMapLoad = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    console.log('Google Maps 3D loaded successfully');
  };

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      {/* Map Header - Simplified */}
      <div className="border-b border-white/10 p-6">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <Map className="h-8 w-8 text-secondary" />
            <h2 className="text-2xl font-bold text-white">MAP</h2>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="relative flex-1">
        {/* Google Maps 3D */}
        <GoogleMap3D
          className="h-full w-full"
          onMapLoad={handleMapLoad}
          mapState={mapState}
          overlayData={overlayData}
          onCameraReady={onCameraReady}
        />

        {/* Floating Particles Overlay - Shows when map updates */}
        {showParticles && (
          <div className="absolute inset-0 pointer-events-none z-[9999] animate-in fade-in duration-500 animate-out fade-out duration-1000">
            <FloatingParticles className="absolute inset-0" />
          </div>
        )}

        {/* Map Info Badge */}
        <div className="absolute bottom-6 left-6">
          <Badge variant="outline" className="bg-black/80 border-white/20 text-white text-lg px-4 py-2">
            Zürich
          </Badge>
        </div>
      </div>
    </div>
  );
}