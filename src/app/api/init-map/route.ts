import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Call backend with default parameters
    const response = await fetch(`${backendUrl}/design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: [],
        remaining_roadway_width_min: 3.0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();

    // Apply colors to all layers
    if (data.parking_spots?.features) {
      data.parking_spots.features = data.parking_spots.features.map((f: any) => ({
        ...f,
        properties: { ...f.properties, type: 'parking', color: '#00F0FF', stroke_width: 2 }
      }));
    }

    if (data.remaining_roadway_widths?.features) {
      data.remaining_roadway_widths.features = data.remaining_roadway_widths.features.map((f: any) => ({
        ...f,
        properties: { ...f.properties, color: '#FFFFFF', stroke_width: 4 }
      }));
    }

    if (data.safety_margins?.features) {
      data.safety_margins.features = data.safety_margins.features.map((f: any) => ({
        ...f,
        properties: { ...f.properties, type: 'safety_margin', color: '#FFFFFF', stroke_width: 3 }
      }));
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Init map error:', error);
    return NextResponse.json({ error: 'Failed to initialize map' }, { status: 500 });
  }
}
