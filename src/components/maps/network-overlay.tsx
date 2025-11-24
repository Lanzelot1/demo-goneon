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
    type?: string;
    object_type?: string;
    fill_opacity?: number;
    stroke_width?: number;
    stroke_color?: string;
    marker_size?: number;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface NetworkOverlayProps {
  lanes: LaneFeature[];
  visible?: boolean;
}

// Lane type color mapping
const LANE_COLORS: Record<string, string> = {
  'M': '#4B5563',  // Motor - Gray
  'T': '#EF4444',  // Transit - Red
  'L': '#8B1F2E',  // Bicycle - Burgundy
  'G': '#1E5631',  // Green lanes - Forest Green
  'R': '#00F0FF',  // Parking - Cyan
};

// Object type color mapping
const OBJECT_TYPE_COLORS: Record<string, string> = {
  'parking_spot': '#00F0FF',
  'curb': '#FFFFFF',
  'roadway': '#FFA500',
};

export function NetworkOverlay({ lanes, visible = true }: NetworkOverlayProps) {
  const polylinesRef = useRef<HTMLElement[]>([]);
  const maps3dLibrary = useMapsLibrary('maps3d');

  useEffect(() => {
    if (!maps3dLibrary || lanes.length === 0 || !visible) return;

    let mounted = true;

    Promise.all([
      customElements.whenDefined('gmp-polyline-3d'),
      customElements.whenDefined('gmp-polygon-3d')
    ]).then(() => {
      if (!mounted) return;

      const map3d = document.querySelector('gmp-map-3d');
      if (!map3d) return;

      lanes.forEach((lane, index) => {
        const geometryType = lane.geometry.type;

        // Get color from properties or fallback to type mappings
        const color = lane.properties.color ||
                      (lane.properties.object_type && OBJECT_TYPE_COLORS[lane.properties.object_type]) ||
                      (lane.properties.lane_type_code && LANE_COLORS[lane.properties.lane_type_code]) ||
                      '#6B7280';

        const width = lane.properties.stroke_width || 4;
        const id = `network-lane-${lane.properties.street_id || lane.properties.type || index}-${index}`;

        // Remove existing element if it exists
        const existing = document.getElementById(id);
        if (existing?.parentNode) {
          existing.parentNode.removeChild(existing);
        }

        if (geometryType === 'Point') {
          // Create circular marker for points
          const coords = lane.geometry.coordinates;
          const markerSize = lane.properties.marker_size || 0.5;
          const lat = coords[1];
          const lng = coords[0];

          const numPoints = 16;
          const latOffset = markerSize / 111000;
          const lngOffset = markerSize / (111000 * Math.cos(lat * Math.PI / 180));

          const circlePath = [];
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            circlePath.push({
              lat: lat + latOffset * Math.sin(angle),
              lng: lng + lngOffset * Math.cos(angle),
              altitude: 2
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
          // Render filled polygons (parking spots, etc.)
          const outerRing = lane.geometry.coordinates[0];

          const path = outerRing.map((coord: number[]) => ({
            lat: coord[1],
            lng: coord[0],
            altitude: 0,
          }));

          const strokeColor = lane.properties.stroke_color || color;

          const polygon = document.createElement('gmp-polygon-3d') as any;
          polygon.id = id;
          polygon.setAttribute('fill-color', '#00000000');
          polygon.setAttribute('stroke-color', strokeColor);
          polygon.setAttribute('stroke-width', width.toString());
          polygon.setAttribute('altitude-mode', 'clamp-to-ground');
          polygon.setAttribute('draws-occluded-segments', 'false');
          polygon.outerCoordinates = path;

          polylinesRef.current.push(polygon);
          map3d.appendChild(polygon);

        } else if (geometryType === 'MultiLineString') {
          // Render multiple line segments
          const lines = lane.geometry.coordinates;

          lines.forEach((coords: number[][], lineIndex: number) => {
            const path = coords.map((coord: number[]) => ({
              lat: coord[1],
              lng: coord[0],
              altitude: 0,
            }));

            const polyline = document.createElement('gmp-polyline-3d') as any;
            polyline.id = `${id}-line-${lineIndex}`;
            polyline.setAttribute('stroke-color', color);
            polyline.setAttribute('stroke-width', width.toString());
            polyline.setAttribute('altitude-mode', 'clamp-to-ground');
            polyline.setAttribute('draws-occluded-segments', 'false');
            polyline.path = path;

            polylinesRef.current.push(polyline);
            map3d.appendChild(polyline);
          });

        } else {
          // Render single LineStrings
          const coords = lane.geometry.coordinates;

          const path = coords.map((coord: number[]) => ({
            lat: coord[1],
            lng: coord[0],
            altitude: 0,
          }));

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
    });

    return () => {
      mounted = false;
      polylinesRef.current.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      polylinesRef.current = [];
    };
  }, [maps3dLibrary, lanes, visible]);

  return null;
}
