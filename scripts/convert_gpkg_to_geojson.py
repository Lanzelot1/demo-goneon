#!/usr/bin/env python3
"""
Convert GeoPackage network data to GeoJSON format for web display.

This script reads lane network data from GeoPackage format and converts it to
GeoJSON for overlay on Google Maps 3D. It simplifies the data by keeping only
essential properties for visualization.
"""

import geopandas as gpd
import json
from pathlib import Path

# Define paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent.parent / "DATA" / "agent"
OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "data"

# Input files
LANES_GPKG = DATA_DIR / "lanes_with_offsets_4326.gpkg"
STREETS_GPKG = DATA_DIR / "streets_4326.gpkg"

# Output files
LANES_GEOJSON = OUTPUT_DIR / "lanes.geojson"
STREETS_GEOJSON = OUTPUT_DIR / "streets.geojson"

# Lane type color mapping for visualization
LANE_COLORS = {
    'M': '#4B5563',  # Motor - Darker Gray
    'T': '#EF4444',  # Transit - Red
    'L': '#8B1F2E',  # Bicycle - Darker Burgundy (Barcelona style)
    'G': '#1E5631',  # Green lanes - Darker Forest Green
    'R': '#3B82F6',  # Parking - Blue
}

def simplify_lane_properties(gdf):
    """Keep only essential properties for visualization."""
    # Select only the columns we need
    columns_to_keep = ['geometry', 'lane_type_code', 'width', 'street_id']

    # Filter columns that exist
    available_columns = [col for col in columns_to_keep if col in gdf.columns]
    gdf_simplified = gdf[available_columns].copy()

    # Add color based on lane type
    if 'lane_type_code' in gdf_simplified.columns:
        gdf_simplified['color'] = gdf_simplified['lane_type_code'].map(
            lambda x: LANE_COLORS.get(x, '#6B7280')  # Default to gray
        )

    return gdf_simplified

def convert_lanes():
    """Convert lanes GeoPackage to GeoJSON."""
    print(f"Reading lanes from {LANES_GPKG}...")
    lanes_gdf = gpd.read_file(LANES_GPKG)

    print(f"  Found {len(lanes_gdf)} lanes")
    print(f"  CRS: {lanes_gdf.crs}")

    # Simplify properties
    lanes_gdf = simplify_lane_properties(lanes_gdf)

    # Save to GeoJSON
    print(f"Writing to {LANES_GEOJSON}...")
    lanes_gdf.to_file(LANES_GEOJSON, driver='GeoJSON')

    # Get file size
    size_mb = LANES_GEOJSON.stat().st_size / (1024 * 1024)
    print(f"  Output size: {size_mb:.2f} MB")

    return len(lanes_gdf)

def convert_streets():
    """Convert streets GeoPackage to GeoJSON."""
    print(f"\nReading streets from {STREETS_GPKG}...")
    streets_gdf = gpd.read_file(STREETS_GPKG)

    print(f"  Found {len(streets_gdf)} streets")
    print(f"  CRS: {streets_gdf.crs}")

    # Keep only essential columns
    columns_to_keep = ['geometry', 'osm_name', 'street_id']
    available_columns = [col for col in columns_to_keep if col in streets_gdf.columns]
    streets_gdf = streets_gdf[available_columns].copy()

    # Save to GeoJSON
    print(f"Writing to {STREETS_GEOJSON}...")
    streets_gdf.to_file(STREETS_GEOJSON, driver='GeoJSON')

    # Get file size
    size_mb = STREETS_GEOJSON.stat().st_size / (1024 * 1024)
    print(f"  Output size: {size_mb:.2f} MB")

    return len(streets_gdf)

def main():
    """Main conversion function."""
    print("=" * 60)
    print("Converting GeoPackage network data to GeoJSON")
    print("=" * 60)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Convert lanes
    if LANES_GPKG.exists():
        num_lanes = convert_lanes()
    else:
        print(f"Warning: {LANES_GPKG} not found")
        num_lanes = 0

    # Convert streets
    if STREETS_GPKG.exists():
        num_streets = convert_streets()
    else:
        print(f"Warning: {STREETS_GPKG} not found")
        num_streets = 0

    print("\n" + "=" * 60)
    print("Conversion complete!")
    print(f"  Lanes: {num_lanes}")
    print(f"  Streets: {num_streets}")
    print("=" * 60)

if __name__ == "__main__":
    main()
