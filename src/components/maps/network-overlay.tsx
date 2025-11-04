"use client";

import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface LaneFeature {
  type: string;
  properties: {
    width?: number;
    street_id?: string;
    lane_type_code?: string;
    color?: string;
    type?: string;  // e.g., 'parking', 'ev_parking', 'charging_station'
    fill_opacity?: number;
    stroke_width?: number;
    marker_size?: number;
  };
  geometry: {
    type: string;
    coordinates: any;  // Can be Point, LineString, or Polygon
  };
}

interface NetworkOverlayProps {
  lanes: LaneFeature[];
  visible?: boolean;
}

// Lane type color mapping
const LANE_COLORS: Record<string, string> = {
  'M': '#4B5563',  // Motor - Darker Gray
  'T': '#EF4444',  // Transit - Red
  'L': '#8B1F2E',  // Bicycle - Darker Burgundy (Barcelona style)
  'G': '#1E5631',  // Green lanes - Darker Forest Green
  'R': '#00F0FF',  // Parking - Neon Cyan Blue
};

export function NetworkOverlay({ lanes, visible = true }: NetworkOverlayProps) {
  const polylinesRef = useRef<HTMLElement[]>([]);
  const maps3dLibrary = useMapsLibrary('maps3d');

  useEffect(() => {
    if (!maps3dLibrary || lanes.length === 0 || !visible) return;

    let mounted = true;

    // Wait for the custom element to be defined
    customElements.whenDefined('gmp-polyline-3d').then(() => {
      if (!mounted) return;

      const map3d = document.querySelector('gmp-map-3d');
      if (!map3d) return;

      console.log(`Creating ${lanes.length} polylines...`);

      // Create all polylines/polygons/markers at once
      lanes.forEach((lane, index) => {
        const geometryType = lane.geometry.type;

        // Get color - prioritize: feature color > lane type code > default
        const color = lane.properties.color ||
                      (lane.properties.lane_type_code && LANE_COLORS[lane.properties.lane_type_code]) ||
                      '#6B7280';

        const width = lane.properties.stroke_width || Math.max(lane.properties.width || 3.5, 4);
        const id = `network-lane-${lane.properties.street_id || lane.properties.type || index}-${index}`;

        // Remove existing element if it exists to ensure fresh rendering
        const existing = document.getElementById(id);
        if (existing && existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }

        if (geometryType === 'Point') {
          // For Points: create marker/circle (e.g., charging stations)
          const coords = lane.geometry.coordinates;

          // Create a circular polygon to represent the point
          const markerSize = lane.properties.marker_size || 0.5;  // meters (very small for charging station markers)
          const lat = coords[1];
          const lng = coords[0];

          // Create a simple circle marker using polygon
          const numPoints = 16;
          const latOffset = markerSize / 111000;  // Rough meters to degrees conversion
          const lngOffset = markerSize / (111000 * Math.cos(lat * Math.PI / 180));

          const circlePath = [];
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            circlePath.push({
              lat: lat + latOffset * Math.sin(angle),
              lng: lng + lngOffset * Math.cos(angle),
              altitude: 2  // Slightly elevated to appear on top
            });
          }

          const marker = document.createElement('gmp-polygon-3d') as any;
          marker.id = id;
          marker.setAttribute('fill-color', color);
          marker.setAttribute('stroke-color', color);
          marker.setAttribute('stroke-width', '2');
          marker.setAttribute('altitude-mode', 'relative-to-ground');
          marker.setAttribute('draws-occluded-segments', 'false');
          marker.outerCoordinates = circlePath;

          polylinesRef.current.push(marker);
          map3d.appendChild(marker);
        } else if (geometryType === 'Polygon') {
          // For Polygons: use gmp-polygon-3d with fill
          const outerRing = lane.geometry.coordinates[0];

          // Convert GeoJSON coordinates [lng, lat] to {lat, lng}
          const path = outerRing.map(([lng, lat]) => ({
            lat,
            lng,
            altitude: 0,
          }));

          // Get opacity from properties or use default
          const fillOpacity = lane.properties.fill_opacity !== undefined ? lane.properties.fill_opacity : 0.7;
          const alphaHex = Math.round(fillOpacity * 255).toString(16).padStart(2, '0').toUpperCase();

          // Create polygon element with fill
          const polygon = document.createElement('gmp-polygon-3d') as any;
          polygon.id = id;
          polygon.setAttribute('fill-color', color + alphaHex);  // Apply opacity
          polygon.setAttribute('stroke-color', color);
          polygon.setAttribute('stroke-width', width.toString());
          polygon.setAttribute('altitude-mode', 'clamp-to-ground');
          polygon.setAttribute('draws-occluded-segments', 'false');
          polygon.outerCoordinates = path;

          polylinesRef.current.push(polygon);
          map3d.appendChild(polygon);
        } else {
          // For LineStrings: use gmp-polyline-3d (stroke only)
          const coords = lane.geometry.coordinates;

          // Convert GeoJSON coordinates [lng, lat] to {lat, lng}
          const path = coords.map(([lng, lat]) => ({
            lat,
            lng,
            altitude: 0,
          }));

          // Create polyline element
          const polyline = document.createElement('gmp-polyline-3d') as any;
          polyline.id = id;
          polyline.setAttribute('stroke-color', color);
          polyline.setAttribute('stroke-width', width.toString());
          polyline.setAttribute('altitude-mode', 'clamp-to-ground');
          polyline.setAttribute('draws-occluded-segments', 'false');
          polyline.path = path;

          polylinesRef.current.push(polyline);
          map3d.appendChild(polyline);
        }
      });

      console.log(`Added ${polylinesRef.current.length} polylines to map`);
    });

    // Cleanup function
    return () => {
      mounted = false;
      polylinesRef.current.forEach(polyline => {
        if (polyline.parentNode) {
          polyline.parentNode.removeChild(polyline);
        }
      });
      polylinesRef.current = [];
    };
  }, [maps3dLibrary, lanes, visible]);

  // This component doesn't render anything to the React tree
  return null;
}
