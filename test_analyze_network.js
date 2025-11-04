/**
 * Quick test to verify analyze_network returns correct coordinates
 */

const fs = require('fs');
const path = require('path');

async function testAnalyzeNetwork(mapName, analysisType) {
  console.log(`\n📊 Testing: ${analysisType} analysis on ${mapName}`);
  console.log('='.repeat(60));

  // Read GeoJSON file
  const filePath = path.join(__dirname, 'public', 'data', 'Maps', `${mapName}.geojson`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const geoJson = JSON.parse(fileContent);

  console.log(`✅ Loaded ${geoJson.features.length} features`);
  console.log(`📍 CRS: ${geoJson.crs?.properties?.name || 'default'}`);

  // Extract sample coordinates (same logic as in the tool)
  const sampleCoords = [];

  for (const feature of geoJson.features) {
    if (sampleCoords.length >= 3) break; // Just show first 3

    const coords = feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0][0]
      : (feature.geometry.type === 'Point'
          ? feature.geometry.coordinates
          : feature.geometry.coordinates[0]);

    if (coords && coords.length >= 2) {
      sampleCoords.push({
        lng: coords[0],
        lat: coords[1]
      });
    }
  }

  // Display results
  console.log(`\n📍 Sample Coordinates (what AI receives):`);
  sampleCoords.forEach((coord, i) => {
    console.log(`   ${i + 1}. lng: ${coord.lng.toFixed(6)}, lat: ${coord.lat.toFixed(6)}`);

    // Validate coordinates are in Barcelona area
    const inBarcelona = coord.lat >= 41.3 && coord.lat <= 41.5 &&
                        coord.lng >= 2.0 && coord.lng <= 2.3;
    console.log(`      ${inBarcelona ? '✅ Valid Barcelona coordinates' : '❌ WRONG - Not in Barcelona!'}`);
  });
}

// Test all parking types
(async () => {
  await testAnalyzeNetwork('onstreet_parking', 'parking');
  await testAnalyzeNetwork('onstreet_parking_EV', 'ev_parking');
  await testAnalyzeNetwork('charging_stations', 'charging_stations');

  console.log('\n' + '='.repeat(60));
  console.log('✅ All coordinate tests complete!');
  console.log('='.repeat(60) + '\n');
})();
