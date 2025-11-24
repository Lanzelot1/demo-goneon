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
    object_type?: string;  // e.g., 'parking_spot', 'curb', 'roadway'
    fill_opacity?: number;
    stroke_width?: number;
    stroke_color?: string;
    marker_size?: number;
    remaining_roadway_width?: number;  // Width measurement value
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

// Object type color mapping for Zürich data
const OBJECT_TYPE_COLORS: Record<string, string> = {
  'parking_spot': '#00FFFF',  // Bright Cyan - highly visible parking
  'curb': '#FFFFFF',          // White - street edges
  'roadway': '#FFA500',       // Orange - remaining road width
  'remaining_width': '#FF8C00', // Dark Orange - for roadway width indicators
};

export function NetworkOverlay({ lanes, visible = true }: NetworkOverlayProps) {
  const polylinesRef = useRef<HTMLElement[]>([]);
  const maps3dLibrary = useMapsLibrary('maps3d');

  useEffect(() => {
    if (!maps3dLibrary || lanes.length === 0 || !visible) return;

    // Quick check: are we rendering parking data?
    const hasParkingSpots = lanes.some(lane => lane.properties.object_type === 'parking_spot');
    if (hasParkingSpots) {
      console.log(`🅿️ NetworkOverlay: Rendering parking spots! Total lanes: ${lanes.length}`);
    }

    let mounted = true;

    // Wait for the custom elements to be defined
    Promise.all([
      customElements.whenDefined('gmp-polyline-3d'),
      customElements.whenDefined('gmp-polygon-3d')
    ]).then(() => {
      if (!mounted) return;

      const map3d = document.querySelector('gmp-map-3d');
      if (!map3d) return;

      console.log(`🎨 Rendering ${lanes.length} network features...`);

      // Track geometry types for debugging
      const geometryTypes: Record<string, number> = {};
      let parkingCount = 0;
      let polygonCount = 0;

      // Create all polylines/polygons/markers at once
      lanes.forEach((lane, index) => {
        const geometryType = lane.geometry.type;
        geometryTypes[geometryType] = (geometryTypes[geometryType] || 0) + 1;

        // Debug parking spots specifically - only count Polygons as actual parking spots
        if (lane.properties.object_type === 'parking_spot' && geometryType === 'Polygon') {
          parkingCount++;
          console.log(`🚗 Parking spot ${parkingCount}: geometry=${geometryType}, color=${lane.properties.color}`);
          if (parkingCount <= 2) {
            console.log(`   Coordinates:`, lane.geometry.coordinates);
          }
        }

        // Determine color based on geometry type and properties
        // For LineStrings with parking_spot object_type, treat as roadway width indicators
        let color = '#6B7280'; // Default gray

        if (geometryType === 'Polygon' && lane.properties.object_type === 'parking_spot') {
          // Real parking spots (polygons) - bright cyan
          color = '#00FFFF';
        } else if (geometryType === 'LineString' && lane.properties.object_type === 'parking_spot') {
          // Roadway width indicators mislabeled as parking - orange
          color = '#FF8C00';
        } else {
          // Use standard color mapping
          color = lane.properties.color ||
                  (lane.properties.object_type && OBJECT_TYPE_COLORS[lane.properties.object_type]) ||
                  (lane.properties.lane_type_code && LANE_COLORS[lane.properties.lane_type_code]) ||
                  '#6B7280';
        }

        const width = lane.properties.stroke_width || 6;  // Default to thicker lines for visibility
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
          polygonCount++;
          // For Polygons: use gmp-polygon-3d with fill
          const outerRing = lane.geometry.coordinates[0];

          // Convert GeoJSON coordinates [lng, lat] to {lat, lng}
          // Add slight elevation for parking spots to ensure visibility
          const isParking = lane.properties.type === 'parking' ||
                          lane.properties.object_type === 'parking_spot';

          if (isParking) {
            console.log(`   🅿️ Creating parking polygon ${polygonCount}`);
          }

          const altitude = isParking ? 5.0 : 0;  // Much higher elevation for better visibility

          const path = outerRing.map((coord: number[]) => {
            const [lng, lat] = coord;
            return {
              lat,
              lng,
              altitude: altitude,
            };
          });

          // Get opacity from properties or use default
          // Use high opacity for parking spots for better visibility
          const fillOpacity = isParking ? 0.8 : (lane.properties.fill_opacity !== undefined ? lane.properties.fill_opacity : 0.7);
          const alphaHex = Math.round(fillOpacity * 255).toString(16).padStart(2, '0').toUpperCase();

          // Get stroke color (can be different from fill color)
          // Use bright colors for parking spots
          const fillColor = isParking ? '#00FFFF' : color;  // Bright cyan for parking
          const strokeColor = isParking ? '#FFFF00' : (lane.properties.stroke_color || color);  // Yellow stroke for parking

          if (isParking) {
            console.log(`     Fill color: ${fillColor + alphaHex}, Stroke: ${strokeColor}`);
            console.log(`     Path points: ${path.length}, Altitude: ${altitude}m`);
          }

          // Create polygon element with fill
          const polygon = document.createElement('gmp-polygon-3d') as any;
          polygon.id = id;
          polygon.setAttribute('fill-color', fillColor + alphaHex);  // Use appropriate fill color
          polygon.setAttribute('stroke-color', strokeColor);
          polygon.setAttribute('stroke-width', isParking ? '10' : width.toString());  // Much thicker stroke for parking visibility
          polygon.setAttribute('altitude-mode', isParking ? 'relative-to-ground' : 'clamp-to-ground');
          polygon.setAttribute('draws-occluded-segments', 'false');
          polygon.setAttribute('z-index', isParking ? '100' : '1');  // Much higher z-index for parking
          polygon.outerCoordinates = path;

          if (isParking) {
            console.log(`     ✅ Parking polygon created and added to DOM`);
          }

          polylinesRef.current.push(polygon);
          map3d.appendChild(polygon);
        } else if (geometryType === 'MultiLineString') {
          // For MultiLineStrings: create multiple polylines (one for each line segment)
          const lines = lane.geometry.coordinates;

          lines.forEach((coords: number[][], lineIndex: number) => {
            // Convert GeoJSON coordinates [lng, lat] to {lat, lng}
            const path = coords.map((coord: number[]) => {
              const [lng, lat] = coord;
              return {
                lat,
                lng,
                altitude: 0,
              };
            });

            // Create polyline element for this line segment
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
          // For LineStrings: use gmp-polyline-3d (stroke only)
          const coords = lane.geometry.coordinates;

          // Convert GeoJSON coordinates [lng, lat] to {lat, lng}
          const path = coords.map((coord: number[]) => {
            const [lng, lat] = coord;
            return {
              lat,
              lng,
              altitude: 0,
            };
          });

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

      console.log(`✅ Added ${polylinesRef.current.length} elements to map`);
      console.log(`   Geometry breakdown:`, geometryTypes);
      console.log(`   🚗 Parking spots found: ${parkingCount}`);
      console.log(`   📐 Polygons created: ${polygonCount}`);
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
