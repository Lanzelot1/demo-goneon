"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { ChatInterface } from "@/components/chat/chat-interface";
import { MapWidget } from "@/components/maps/map-widget";

export interface MapState {
  baseNetwork: string;
  overlays: string[];
  timestamp?: number;
}

export default function Home() {
  const [mapState, setMapState] = useState<MapState>({
    baseNetwork: "zürich/curbs",
    overlays: ["zürich/parking_spots", "zürich/safety_margins", "zürich/remaining_roadway_width"],
    timestamp: Date.now()
  });
  const [overlayData, setOverlayData] = useState<any>(null);
  const updateCameraRef = useRef<((props: any) => void) | null>(null);

  // Fetch initial map data from backend with defaults
  useEffect(() => {
    fetch('/api/init-map')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          console.log('Initial map data loaded from backend');
          setOverlayData(data);
        }
      })
      .catch(err => {
        console.error('Failed to fetch initial map data:', err);
      });
  }, []);

  const handleMapChange = (mapName: string | MapState) => {
    // Support both legacy string format and new MapState format
    if (typeof mapName === 'string') {
      console.log(`Switching map to: ${mapName}`);
      // Legacy format: just a network name, no overlays
      setMapState({
        baseNetwork: mapName,
        overlays: []
      });
    } else {
      console.log(`Switching to map state:`, mapName);
      setMapState(mapName);
    }
  };

  const handleCameraUpdate = (cameraData: any) => {
    console.log(`Updating camera position:`, cameraData);
    if (updateCameraRef.current) {
      updateCameraRef.current({
        center: {
          lat: cameraData.lat,
          lng: cameraData.lng,
          altitude: 0
        },
        range: cameraData.range || 800,
        heading: cameraData.heading || 0,
        tilt: cameraData.tilt || 65,
        roll: cameraData.roll || 0
      });
    }
  };

  const handleOverlayDataChange = (data: any) => {
    console.log(`Updating overlay data:`, data);
    setOverlayData(data);
  };

  return (
    <div className="h-screen bg-black">
      <div className="flex h-screen flex-col">
        {/* Header */}
        <Header />

        {/* Main Demo Interface - Split Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat Interface - Left Side */}
          <div className="w-full md:w-1/3 p-4 flex flex-col">
            <div className="flex-1 bg-black border border-white/10 rounded-xl overflow-hidden">
              <ChatInterface
                onMapChange={handleMapChange}
                onCameraUpdate={handleCameraUpdate}
                onOverlayDataChange={handleOverlayDataChange}
              />
            </div>
          </div>

          {/* Map Widget - Right Side */}
          <div className="hidden md:flex md:w-2/3 p-4 pl-2">
            <div className="w-full bg-black border border-white/10 rounded-xl">
              <MapWidget
                mapState={mapState}
                overlayData={overlayData}
                onCameraReady={(fn) => { updateCameraRef.current = fn; }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}