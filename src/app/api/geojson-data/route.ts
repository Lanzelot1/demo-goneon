import { NextResponse } from 'next/server';
import { geojsonCache } from '@/lib/geojson-cache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId parameter required' },
        { status: 400 }
      );
    }

    const cached = geojsonCache.get(sessionId);

    if (!cached) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    // Return the cached GeoJSON data
    return NextResponse.json(cached.data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching GeoJSON data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GeoJSON data' },
      { status: 500 }
    );
  }
}
