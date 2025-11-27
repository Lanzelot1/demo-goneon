#!/usr/bin/env node
/**
 * Script to fetch default map data from backend and save to static files.
 * This ensures static files match backend defaults (white colors, proper styling).
 */

const fs = require('fs');
const path = require('path');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const OUTPUT_DIR = path.join(__dirname, '../public/data/zürich');

async function fetchAndSave() {
  console.log(`Fetching from ${BACKEND_URL}/design...`);

  const response = await fetch(`${BACKEND_URL}/design`, {
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
  console.log('Received data from backend');

  // Apply colors to parking spots
  if (data.parking_spots?.features) {
    data.parking_spots.features = data.parking_spots.features.map((f) => ({
      ...f,
      properties: { ...f.properties, type: 'parking', color: '#00F0FF', stroke_width: 2 }
    }));

    const parkingPath = path.join(OUTPUT_DIR, 'parking_spots_default.geojson');
    fs.writeFileSync(parkingPath, JSON.stringify(data.parking_spots, null, 2));
    console.log(`Saved ${data.parking_spots.features.length} parking spots to ${parkingPath}`);
  }

  // Apply colors to remaining roadway widths
  if (data.remaining_roadway_widths?.features) {
    data.remaining_roadway_widths.features = data.remaining_roadway_widths.features.map((f) => ({
      ...f,
      properties: { ...f.properties, color: '#FFFFFF', stroke_width: 4 }
    }));

    const roadwayPath = path.join(OUTPUT_DIR, 'remaining_roadway_width_default.geojson');
    fs.writeFileSync(roadwayPath, JSON.stringify(data.remaining_roadway_widths, null, 2));
    console.log(`Saved ${data.remaining_roadway_widths.features.length} roadway widths to ${roadwayPath}`);
  }

  // Apply colors to safety margins
  if (data.safety_margins?.features) {
    data.safety_margins.features = data.safety_margins.features.map((f) => ({
      ...f,
      properties: { ...f.properties, type: 'safety_margin', color: '#FFFFFF', stroke_width: 3 }
    }));

    const marginsPath = path.join(OUTPUT_DIR, 'safety_margins_default.geojson');
    fs.writeFileSync(marginsPath, JSON.stringify(data.safety_margins, null, 2));
    console.log(`Saved ${data.safety_margins.features.length} safety margins to ${marginsPath}`);
  }

  console.log('Done!');
}

fetchAndSave().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
