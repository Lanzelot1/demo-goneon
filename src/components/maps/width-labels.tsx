"use client";

import { useEffect, useRef } from 'react';
import { useMapsLibrary, useMap } from '@vis.gl/react-google-maps';

interface LaneFeature {
  type: string;
  properties: {
    width?: number;
    street_id?: string;
    lane_type_code?: string;
    color?: string;
    type?: string;
    object_type?: string;
    fill_opacity?: number;
    stroke_width?: number;
    stroke_color?: string;
    marker_size?: number;
    remaining_roadway_width?: number;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface WidthLabelsProps {
  features: LaneFeature[];
  visible?: boolean;
}

export function WidthLabels({ features, visible = true }: WidthLabelsProps) {
  const map = useMap();
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markersLibrary = useMapsLibrary('marker');

  useEffect(() => {
    if (!map || !markersLibrary || !visible) return;

    // Clean up existing markers
    markersRef.current.forEach(marker => {
      if (marker.map) {
        marker.map = null;
      }
    });
    markersRef.current = [];

    // Wait for the AdvancedMarkerElement to be available
    if (!markersLibrary.AdvancedMarkerElement) {
      console.warn('AdvancedMarkerElement not available');
      return;
    }

    // Create markers for each width measurement
    features.forEach((feature, index) => {
      if (feature.geometry.type !== 'LineString') return;

      const width = feature.properties.remaining_roadway_width;
      if (!width) return;  // Skip if no width value

      // Calculate midpoint of the line
      const coords = feature.geometry.coordinates as number[][];
      const midIndex = Math.floor(coords.length / 2);
      const midpoint = coords[midIndex];

      if (!midpoint || midpoint.length < 2) return;

      const [lng, lat] = midpoint;

      // Create a custom HTML element for the label
      const labelDiv = document.createElement('div');
      labelDiv.className = 'width-label';
      labelDiv.style.cssText = `
        background-color: rgba(255, 102, 0, 0.9);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: bold;
        font-family: monospace;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 1px solid rgba(255, 102, 0, 1);
        z-index: 100;
      `;
      labelDiv.textContent = `${width.toFixed(1)}m`;

      // Create the advanced marker
      try {
        const marker = new markersLibrary.AdvancedMarkerElement({
          map: map,
          position: { lat, lng },
          content: labelDiv,
          zIndex: 1000,  // Ensure labels appear above other elements
        });

        markersRef.current.push(marker);
      } catch (error) {
        console.error('Error creating width label marker:', error);
      }
    });

    // Cleanup function
    return () => {
      markersRef.current.forEach(marker => {
        if (marker.map) {
          marker.map = null;
        }
      });
      markersRef.current = [];
    };
  }, [map, markersLibrary, features, visible]);

  // This component doesn't render anything to the React tree
  return null;
}