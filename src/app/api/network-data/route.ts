import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    // Parse URL to get query parameters
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('type') || 'lanes';
    const mapName = searchParams.get('map') || 'zürich/curbs';

    console.log(`[API] network-data: type=${dataType}, map=${mapName}`);

    // Map selection for different transformation states
    const mapFiles: Record<string, string> = {
      'initial_network': 'Maps/initial_network.geojson',
      'one_superblock': 'Maps/one_superblock.geojson',
      'cycling_corridor': 'Maps/cycling_corridor.geojson',
      'all_superblocks': 'Maps/all_superblocks.geojson',
      // Zürich data files
      'zürich/curbs': 'zürich/curbs.geojson',
      'zürich/parking_spots': 'zürich/parking_spots.geojson',
      'zürich/remaining_roadway_width': 'zürich/remaining_roadway_width.geojson',
    };

    // Define the file path
    const filename = dataType === 'streets'
      ? 'streets.geojson'
      : (mapFiles[mapName] || mapFiles['zürich/curbs']);
    const filePath = path.join(process.cwd(), 'public', 'data', filename);

    console.log(`[API] Loading file: ${filename}`);
    console.log(`[API] Full path: ${filePath}`);

    // Read the GeoJSON file
    const fileContents = await fs.readFile(filePath, 'utf8');
    const geojson = JSON.parse(fileContents);

    // Debug: Check what geometry type we're returning
    if (geojson.features && geojson.features.length > 0) {
      console.log(`[API] First feature geometry type: ${geojson.features[0].geometry.type}`);
      console.log(`[API] First feature object_type: ${geojson.features[0].properties?.object_type}`);
    }

    // Return the GeoJSON with proper headers
    return NextResponse.json(geojson, {
      headers: {
        'Content-Type': 'application/geo+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching during development
      },
    });
  } catch (error) {
    console.error('Error reading network data:', error);
    return NextResponse.json(
      { error: 'Failed to load network data' },
      { status: 500 }
    );
  }
}
