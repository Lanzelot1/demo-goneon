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
  const markersRef = useRef<HTMLElement[]>([]);
  const maps3dLibrary = useMapsLibrary('maps3d');
  const markerLibrary = useMapsLibrary('marker');

  useEffect(() => {
    if (!maps3dLibrary || !markerLibrary || features.length === 0 || !visible) return;

    let mounted = true;

    // Wait for the 3D marker element to be defined
    customElements.whenDefined('gmp-marker-3d').then(() => {
      if (!mounted) return;

      const map3d = document.querySelector('gmp-map-3d');
      if (!map3d) return;

      // Create markers for each width measurement
      features.forEach((feature, index) => {
        if (feature.geometry.type !== 'LineString') return;

        const width = feature.properties.remaining_roadway_width;
        if (!width) return;

        // Calculate midpoint of the line
        const coords = feature.geometry.coordinates as number[][];
        const midIndex = Math.floor(coords.length / 2);
        const midpoint = coords[midIndex];

        if (!midpoint || midpoint.length < 2) return;

        const [lng, lat] = midpoint;
        const id = `width-label-${index}`;

        // Remove existing element if it exists
        const existing = document.getElementById(id);
        if (existing?.parentNode) {
          existing.parentNode.removeChild(existing);
        }

        // Create the 3D marker with label
        const marker = document.createElement('gmp-marker-3d') as any;
        marker.id = id;
        marker.setAttribute('position', `${lat},${lng},0`);
        marker.setAttribute('altitude-mode', 'relative-to-ground');
        marker.setAttribute('label', `${width.toFixed(1)}m`);

        // Add a very small pin to minimize visual clutter using proper PinElement API
        const pin = new markerLibrary.PinElement({
          scale: 0.1
        });
        marker.appendChild(pin.element);

        markersRef.current.push(marker);
        map3d.appendChild(marker);
      });
    });

    // Cleanup function
    return () => {
      mounted = false;
      markersRef.current.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      markersRef.current = [];
    };
  }, [maps3dLibrary, markerLibrary, features, visible]);

  return null;
}
