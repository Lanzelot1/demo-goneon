#!/usr/bin/env python3
"""
Convert GeoPackage maps to GeoJSON format for web display.

This script reads GPKG files from the Maps folder and converts them to
GeoJSON for overlay on Google Maps 3D. It handles both single-layer and
multi-layer GPKG files, simplifying the data for web visualization.
"""

import geopandas as gpd
import fiona
from pathlib import Path

# Define paths
SCRIPT_DIR = Path(__file__).parent
MAPS_DIR = SCRIPT_DIR.parent / "public" / "data" / "Maps"

# Input GPKG files
GPKG_FILES = [
    "initial_network.gpkg",
    "one_superblock.gpkg",
    "cycling_corridor.gpkg",
    "all_superblocks.gpkg",
    "various_superblocks_v2.gpkg"
]

# Lane type color mapping for visualization
LANE_COLORS = {
    'M': '#4B5563',  # Motor - Darker Gray
    'T': '#EF4444',  # Transit - Red
    'L': '#8B1F2E',  # Bicycle - Darker Burgundy (Barcelona style)
    'G': '#1E5631',  # Green lanes - Darker Forest Green
    'R': '#3B82F6',  # Parking - Blue
}

def simplify_properties(gdf, layer_name=None):
    """Keep only essential properties for visualization."""
    # Determine what type of data this is based on columns
    columns = gdf.columns.tolist()

    # Common columns to keep if they exist
    essential_columns = ['geometry']

    # Check for lane-specific columns (including 'lanetype' variant)
    if 'lane_type_code' in columns or 'lanetype' in columns:
        # This is lane data
        # Handle both 'lane_type_code' and 'lanetype' column names
        lane_type_col = 'lane_type_code' if 'lane_type_code' in columns else 'lanetype'

        columns_to_keep = ['geometry', lane_type_col, 'width', 'street_id', 'id', 'position']
        available_columns = [col for col in columns_to_keep if col in columns]
        gdf_simplified = gdf[available_columns].copy()

        # Normalize column name for consistency
        if 'lanetype' in gdf_simplified.columns:
            gdf_simplified['lane_type_code'] = gdf_simplified['lanetype']
            if 'lanetype' in available_columns:
                gdf_simplified = gdf_simplified.drop('lanetype', axis=1)

        # Add color based on lane type
        if 'lane_type_code' in gdf_simplified.columns:
            gdf_simplified['color'] = gdf_simplified['lane_type_code'].map(
                lambda x: LANE_COLORS.get(x, '#6B7280')  # Default to gray
            )

    # Check for street-specific columns
    elif 'osm_name' in columns or ('street_id' in columns and 'lanetype' not in columns):
        # This is street data
        columns_to_keep = ['geometry', 'osm_name', 'street_id', 'name']
        available_columns = [col for col in columns_to_keep if col in columns]
        gdf_simplified = gdf[available_columns].copy()

    else:
        # Keep a reasonable subset of columns for unknown data
        # Keep geometry and up to 5 other important-looking columns
        important_patterns = ['name', 'id', 'type', 'class', 'category']
        kept_columns = ['geometry']

        for col in columns:
            if col == 'geometry':
                continue
            # Keep columns that match important patterns
            col_lower = col.lower()
            if any(pattern in col_lower for pattern in important_patterns):
                kept_columns.append(col)
                if len(kept_columns) >= 6:  # geometry + 5 others
                    break

        # If we didn't find enough important columns, just take the first few
        if len(kept_columns) < 6:
            for col in columns:
                if col not in kept_columns:
                    kept_columns.append(col)
                    if len(kept_columns) >= 6:
                        break

        gdf_simplified = gdf[kept_columns].copy()

    return gdf_simplified

def convert_gpkg_to_geojson(gpkg_path, output_path):
    """Convert a single GPKG file to GeoJSON."""
    print(f"\nProcessing {gpkg_path.name}...")

    try:
        # Check if the file has multiple layers
        layers = fiona.listlayers(str(gpkg_path))

        if len(layers) > 1:
            print(f"  Found {len(layers)} layers: {layers}")

            # Process each layer separately
            for i, layer in enumerate(layers):
                print(f"  Processing layer '{layer}'...")
                gdf = gpd.read_file(gpkg_path, layer=layer)

                print(f"    Features: {len(gdf)}")
                print(f"    CRS: {gdf.crs}")

                # Ensure CRS is WGS84 for web display
                if gdf.crs and gdf.crs != 'EPSG:4326':
                    print(f"    Converting CRS to EPSG:4326...")
                    gdf = gdf.to_crs('EPSG:4326')

                # Simplify properties
                gdf = simplify_properties(gdf, layer_name=layer)

                # Create layer-specific output filename
                layer_suffix = f"_{layer.replace(' ', '_').lower()}" if len(layers) > 1 else ""
                layer_output = output_path.parent / f"{output_path.stem}{layer_suffix}.geojson"

                # Save to GeoJSON
                print(f"    Writing to {layer_output.name}...")
                gdf.to_file(layer_output, driver='GeoJSON')

                # Get file size
                size_mb = layer_output.stat().st_size / (1024 * 1024)
                print(f"    Output size: {size_mb:.2f} MB")

        else:
            # Single layer file
            print(f"  Single layer file")
            gdf = gpd.read_file(gpkg_path)

            print(f"  Features: {len(gdf)}")
            print(f"  CRS: {gdf.crs}")
            print(f"  Columns: {list(gdf.columns)[:10]}")  # Show first 10 columns

            # Ensure CRS is WGS84 for web display
            if gdf.crs and gdf.crs != 'EPSG:4326':
                print(f"  Converting CRS to EPSG:4326...")
                gdf = gdf.to_crs('EPSG:4326')

            # Simplify properties
            gdf = simplify_properties(gdf)
            print(f"  Keeping columns: {list(gdf.columns)}")

            # Save to GeoJSON
            print(f"  Writing to {output_path.name}...")
            gdf.to_file(output_path, driver='GeoJSON')

            # Get file size
            size_mb = output_path.stat().st_size / (1024 * 1024)
            print(f"  Output size: {size_mb:.2f} MB")

        return True

    except Exception as e:
        print(f"  Error processing {gpkg_path.name}: {e}")
        return False

def main():
    """Main conversion function."""
    print("=" * 60)
    print("Converting Maps GeoPackage files to GeoJSON")
    print("=" * 60)

    # Ensure Maps directory exists
    if not MAPS_DIR.exists():
        print(f"Error: Maps directory not found at {MAPS_DIR}")
        return

    # Track conversion results
    successful = []
    failed = []

    # Process each GPKG file
    for gpkg_filename in GPKG_FILES:
        gpkg_path = MAPS_DIR / gpkg_filename

        if not gpkg_path.exists():
            print(f"\nWarning: {gpkg_filename} not found")
            failed.append(gpkg_filename)
            continue

        # Output path (same directory, .geojson extension)
        output_path = MAPS_DIR / gpkg_path.with_suffix('.geojson').name

        # Convert the file
        if convert_gpkg_to_geojson(gpkg_path, output_path):
            successful.append(gpkg_filename)
        else:
            failed.append(gpkg_filename)

    # Print summary
    print("\n" + "=" * 60)
    print("Conversion complete!")
    print(f"  Successful: {len(successful)} files")
    if successful:
        for filename in successful:
            print(f"    ✓ {filename}")

    if failed:
        print(f"  Failed: {len(failed)} files")
        for filename in failed:
            print(f"    ✗ {filename}")
    print("=" * 60)

if __name__ == "__main__":
    main()