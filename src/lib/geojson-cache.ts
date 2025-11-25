// Shared in-memory cache for GeoJSON data
// This avoids sending huge GeoJSON to LLM conversation history

export interface CachedGeoJSON {
  data: {
    parking_spots?: any;
    safety_margins?: any;
    remaining_roadway_widths?: any;
  };
  timestamp: number;
}

export const geojsonCache = new Map<string, CachedGeoJSON>();

// Clean up old cache entries (> 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of geojsonCache.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) {
      geojsonCache.delete(key);
    }
  }
}, 60 * 1000); // Run every minute
