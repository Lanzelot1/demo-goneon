#!/usr/bin/env python3
"""
Convert parking-related GeoPackage files to GeoJSON format.

Converts:
- onstreet_parking.gpkg → onstreet_parking.geojson
- onstreet_parking_EV.gpkg → onstreet_parking_EV.geojson
- charging stations.gpkg → charging_stations.geojson
"""

import geopandas as gpd
from pathlib import Path

# Define paths
SCRIPT_DIR = Path(__file__).parent
MAPS_DIR = SCRIPT_DIR.parent / "public" / "data" / "Maps"

# Files to convert with their display properties
FILES_TO_CONVERT = [
    ("onstreet_parking.gpkg", "onstreet_parking.geojson", {
        "type": "parking",
        "color": "#3B82F6",  # Blue
        "fill_opacity": 0.5,
        "stroke_width": 2
    }),
    ("onstreet_parking_EV.gpkg", "onstreet_parking_EV.geojson", {
        "type": "ev_parking",
        "color": "#10B981",  # Green
        "fill_opacity": 0.6,
        "stroke_width": 2
    }),
    ("charging stations.gpkg", "charging_stations.geojson", {
        "type": "charging_station",
        "color": "#F59E0B",  # Amber/Orange
        "marker_size": 8
    }),
]

def convert_file(input_name, output_name, properties):
    """Convert a single GeoPackage file to GeoJSON with WGS84 coordinates and add properties."""
    input_path = MAPS_DIR / input_name
    output_path = MAPS_DIR / output_name

    if not input_path.exists():
        print(f"❌ File not found: {input_path}")
        return False

    try:
        print(f"📖 Reading {input_name}...")
        gdf = gpd.read_file(input_path)

        print(f"   Found {len(gdf)} features")
        print(f"   Original CRS: {gdf.crs}")

        # Transform to WGS84 (EPSG:4326) if needed
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            print(f"   🔄 Transforming to WGS84 (EPSG:4326)...")
            gdf = gdf.to_crs(epsg=4326)
            print(f"   ✅ Transformed to: {gdf.crs}")
        else:
            print(f"   ✅ Already in WGS84")

        # Add display properties to all features
        print(f"   🎨 Adding display properties...")
        for key, value in properties.items():
            gdf[key] = value
        print(f"      Added: {', '.join(properties.keys())}")

        # Show sample coordinate to verify
        if len(gdf) > 0:
            first_geom = gdf.iloc[0].geometry
            if first_geom.geom_type == 'Point':
                sample_coord = f"[{first_geom.x:.6f}, {first_geom.y:.6f}]"
            elif first_geom.geom_type == 'Polygon':
                coords = list(first_geom.exterior.coords)[0]
                sample_coord = f"[{coords[0]:.6f}, {coords[1]:.6f}]"
            else:
                sample_coord = "N/A"
            print(f"   📍 Sample WGS84 coord: {sample_coord}")
            print(f"   📊 Color: {gdf.iloc[0]['color']}, Type: {gdf.iloc[0]['type']}")

        print(f"💾 Writing to {output_name}...")
        gdf.to_file(output_path, driver='GeoJSON')

        size_kb = output_path.stat().st_size / 1024
        print(f"   ✅ Created {output_name} ({size_kb:.1f} KB)")
        return True

    except Exception as e:
        print(f"❌ Error converting {input_name}: {e}")
        return False

def main():
    """Main conversion function."""
    print("=" * 60)
    print("Converting Parking GeoPackage files to GeoJSON")
    print("=" * 60)
    print()

    success_count = 0

    for input_name, output_name, properties in FILES_TO_CONVERT:
        if convert_file(input_name, output_name, properties):
            success_count += 1
        print()

    print("=" * 60)
    print(f"Conversion complete! {success_count}/{len(FILES_TO_CONVERT)} files converted")
    print("=" * 60)

if __name__ == "__main__":
    main()
