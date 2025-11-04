"use client";

import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export interface Polyline3DProps {
  coordinates: Array<{ lat: number; lng: number; altitude?: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  altitudeMode?: 'clamp-to-ground' | 'relative-to-ground' | 'absolute';
  id?: string;
}

export function Polyline3D({
  coordinates,
  strokeColor = '#6B7280',
  strokeWidth = 3,
  altitudeMode = 'clamp-to-ground',
  id,
}: Polyline3DProps) {
  const polylineRef = useRef<google.maps.maps3d.Polyline3DElement | null>(null);
  const maps3dLibrary = useMapsLibrary('maps3d');

  useEffect(() => {
    if (!maps3dLibrary) return;

    let mounted = true;
    let polyline: google.maps.maps3d.Polyline3DElement | null = null;

    // Wait for the custom element to be defined
    customElements.whenDefined('gmp-polyline-3d').then(() => {
      if (!mounted) return; // Don't create if component unmounted

      // Check if polyline with this ID already exists
      const map3d = document.querySelector('gmp-map-3d');
      if (id && map3d) {
        const existing = map3d.querySelector(`#${id}`);
        if (existing) {
          console.log('Polyline already exists, skipping:', id);
          return;
        }
      }

      // Create the polyline element
      polyline = document.createElement('gmp-polyline-3d') as google.maps.maps3d.Polyline3DElement;

      // Set properties
      if (id) polyline.id = id;
      polyline.setAttribute('stroke-color', strokeColor);
      polyline.setAttribute('stroke-width', strokeWidth.toString());
      polyline.setAttribute('altitude-mode', altitudeMode);
      polyline.setAttribute('draws-occluded-segments', 'true'); // Show through buildings

      // Use 'path' instead of deprecated 'coordinates'
      (polyline as any).path = coordinates.map(coord => ({
        lat: coord.lat,
        lng: coord.lng,
        altitude: coord.altitude || 0,
      }));

      polylineRef.current = polyline;

      // Append to the parent Map3D element
      if (map3d && polyline) {
        map3d.appendChild(polyline);
      }
    });

    // Cleanup function - remove polyline when component unmounts
    return () => {
      mounted = false;
      if (polylineRef.current && polylineRef.current.parentNode) {
        polylineRef.current.parentNode.removeChild(polylineRef.current);
      }
    };
  }, [maps3dLibrary, coordinates, strokeColor, strokeWidth, altitudeMode, id]);

  // This component doesn't render anything to the React tree
  return null;
}
