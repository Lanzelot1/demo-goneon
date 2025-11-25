import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { z } from 'zod';

// Geocode an address using Google Geocoding API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted_address: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('Google Maps API key not found');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
      };
    } else {
      console.error('Geocoding failed:', data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Analyze network GeoJSON data - handles lanes, parking, and EV infrastructure
async function analyzeNetwork(
  mapName: string,
  analysisType: 'lanes' | 'parking' | 'ev_parking' | 'charging_stations' = 'lanes',
  laneTypeFilter?: string
) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Read GeoJSON file from public/data/Maps directory
    const filePath = path.join(process.cwd(), 'public', 'data', 'Maps', `${mapName}.geojson`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const geoJson = JSON.parse(fileContent);

    // Handle different analysis types
    if (analysisType === 'parking' || analysisType === 'ev_parking') {
      // Analyze parking spaces
      const parkingSpaces: any[] = [];
      const sampleCoords: { lat: number; lng: number }[] = [];

      geoJson.features.forEach((feature: any) => {
        const props = feature.properties;
        parkingSpaces.push({
          id: props.id || props.osm_id,
          type: analysisType === 'ev_parking' ? 'EV Parking' : 'General Parking',
          capacity: props.capacity || 1,
        });

        // Extract sample coordinates
        if (sampleCoords.length < 10 && feature.geometry.coordinates) {
          const coords = feature.geometry.type === 'Polygon'
            ? feature.geometry.coordinates[0][0]
            : feature.geometry.coordinates[0];

          if (coords && coords.length >= 2) {
            sampleCoords.push({
              lng: coords[0],
              lat: coords[1]
            });
          }
        }
      });

      const totalCapacity = parkingSpaces.reduce((sum, space) => sum + space.capacity, 0);

      return {
        analysis_type: analysisType,
        map_name: mapName,
        total_spaces: parkingSpaces.length,
        total_capacity: totalCapacity,
        sample_locations: sampleCoords,
        message: analysisType === 'ev_parking'
          ? `Found ${parkingSpaces.length} EV parking zones with capacity for ${totalCapacity} vehicles`
          : `Found ${parkingSpaces.length} parking spaces with capacity for ${totalCapacity} vehicles`
      };
    }

    if (analysisType === 'charging_stations') {
      // Analyze charging stations
      const stations: any[] = [];
      const sampleCoords: { lat: number; lng: number }[] = [];

      geoJson.features.forEach((feature: any) => {
        const props = feature.properties;
        stations.push({
          id: props.id || props.osm_id,
          type: 'EV Charging Station',
          operator: props.operator || 'Unknown',
        });

        // Extract sample coordinates
        if (sampleCoords.length < 10 && feature.geometry.coordinates) {
          const coords = feature.geometry.type === 'Point'
            ? feature.geometry.coordinates
            : (feature.geometry.type === 'Polygon'
                ? feature.geometry.coordinates[0][0]
                : feature.geometry.coordinates[0]);

          if (coords && coords.length >= 2) {
            sampleCoords.push({
              lng: coords[0],
              lat: coords[1]
            });
          }
        }
      });

      return {
        analysis_type: 'charging_stations',
        map_name: mapName,
        total_stations: stations.length,
        sample_locations: sampleCoords,
        message: `Found ${stations.length} EV charging stations`
      };
    }

    // Default: Analyze lanes
    const laneTypeNames: Record<string, string> = {
      'M': 'Motor',
      'L': 'Bicycle',
      'G': 'Green',
      'T': 'Transit',
      'R': 'Parking'
    };

    // Analyze features
    const lanesByType: Record<string, any[]> = {};
    const streetsByType: Record<string, Set<string>> = {};
    const sampleCoords: Record<string, { lat: number; lng: number }[]> = {};

    geoJson.features.forEach((feature: any) => {
      const laneType = feature.properties.lane_type_code;
      const streetId = feature.properties.street_id;
      const width = feature.properties.width || 3.5;

      // Apply filter if specified
      if (laneTypeFilter && laneType !== laneTypeFilter) {
        return;
      }

      // Count by type
      if (!lanesByType[laneType]) {
        lanesByType[laneType] = [];
        streetsByType[laneType] = new Set();
        sampleCoords[laneType] = [];
      }

      lanesByType[laneType].push({ width, streetId });
      streetsByType[laneType].add(streetId);

      // Extract sample coordinate (centroid approximation)
      if (sampleCoords[laneType].length < 5 && feature.geometry.coordinates) {
        const coords = feature.geometry.type === 'Polygon'
          ? feature.geometry.coordinates[0][0]
          : feature.geometry.coordinates[0];

        if (coords && coords.length >= 2) {
          sampleCoords[laneType].push({
            lng: coords[0],
            lat: coords[1]
          });
        }
      }
    });

    // Calculate statistics
    const statistics: Record<string, any> = {};
    let totalLanes = 0;

    Object.entries(lanesByType).forEach(([code, lanes]) => {
      const count = lanes.length;
      totalLanes += count;

      // Approximate length: sum of widths (rough proxy)
      const totalWidth = lanes.reduce((sum: number, lane: any) => sum + lane.width, 0);
      const approxLengthKm = (totalWidth / 1000).toFixed(2);

      statistics[code] = {
        lane_type: laneTypeNames[code] || code,
        count: count,
        unique_streets: streetsByType[code].size,
        approx_length_km: parseFloat(approxLengthKm),
        sample_locations: sampleCoords[code]
      };
    });

    return {
      analysis_type: 'lanes',
      map_name: mapName,
      total_lanes: totalLanes,
      lane_statistics: statistics,
      message: laneTypeFilter
        ? `Found ${lanesByType[laneTypeFilter]?.length || 0} ${laneTypeNames[laneTypeFilter] || laneTypeFilter} lanes`
        : `Analyzed ${totalLanes} total lanes across ${Object.keys(lanesByType).length} types`
    };
  } catch (error) {
    console.error('Network analysis error:', error);
    return {
      error: 'Failed to analyze network',
      message: String(error)
    };
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Convert UIMessages to ModelMessages for the AI SDK
  const modelMessages = convertToModelMessages(messages);

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      reset_network: {
        description: 'Reset the street network to its initial state with all motor vehicle lanes. Use this to undo transformations and return to the baseline configuration.',
        inputSchema: z.object({}),
        execute: async () => {
          // Simulate processing
          await new Promise((resolve) => setTimeout(resolve, 4000));

          return {
            status: 'success',
            action: 'reset',
            map: 'initial_network',
            total_lanes: 3030,
            lane_types: { motor: 3030, bicycle: 0, green: 0 },
            message: 'Network reset to initial state.',
          };
        },
      },
      transform_network: {
        description: 'Transform the street network to create superblocks, cycling corridors, or other sustainable configurations. This reallocates road space for bicycles, pedestrians, and green areas.',
        inputSchema: z.object({
          transformation_type: z.enum(['cycling_corridor', 'all_superblocks'])
            .describe('Type of transformation: cycling_corridor (MESO: main cycling route), or all_superblocks (MACRO: comprehensive city-wide transformation)'),
        }),
        execute: async ({ transformation_type }) => {
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 4000));

          // Map transformation type to result
          const transformations = {
            cycling_corridor: {
              map: 'cycling_corridor',
              lane_types: { motor: 2940, bicycle: 74, green: 43 },
              message: 'Success! I\'ve added a cycling corridor with 74 bicycle lanes and 43 green spaces. Ready to explore the changes?',
            },
            all_superblocks: {
              map: 'all_superblocks',
              lane_types: { motor: 2802, bicycle: 152, green: 183 },
              message: 'Done! Your network now has 152 bicycle lanes and 183 green spaces across the city. Ready to explore?',
            },
          };

          const result = transformations[transformation_type as keyof typeof transformations];

          return {
            status: 'success',
            action: 'transform',
            transformation_type,
            ...result,
            total_lanes: 3030 + (result.lane_types.bicycle || 0) + (result.lane_types.green || 0),
          };
        },
      },
      jump_to_location: {
        description: 'Jump to a specific location within the Central Barcelona coverage area. Accepts addresses, predefined locations, or coordinates. Use the address parameter for any street address or landmark.',
        inputSchema: z.object({
          address: z.string().optional()
            .describe('Street address or landmark to navigate to (e.g., "Passeig de Gràcia, 92" or "Casa Batlló"). Will be geocoded to precise coordinates.'),
          location: z.enum([
            'barcelona_center',
            'sagrada_familia',
            'gothic_quarter',
            'eixample',
          ]).optional()
            .describe('Predefined location within Central Barcelona coverage area'),
          custom_lat: z.number().optional()
            .describe('Custom latitude coordinate (must be within 41.375° to 41.412°)'),
          custom_lng: z.number().optional()
            .describe('Custom longitude coordinate (must be within 2.142° to 2.187°)'),
        }),
        execute: async ({ address, location, custom_lat, custom_lng }) => {
          // Predefined locations within Central Barcelona coverage area
          const locations = {
            barcelona_center: {
              name: 'Barcelona City Center (Plaça Catalunya)',
              lat: 41.3851,
              lng: 2.1734,
              range: 500,
              heading: 0,
              tilt: 30,
            },
            sagrada_familia: {
              name: 'Sagrada Familia',
              lat: 41.4036,
              lng: 2.1744,
              range: 600,
              heading: 45,
              tilt: 30,
            },
            gothic_quarter: {
              name: 'Gothic Quarter',
              lat: 41.3825,
              lng: 2.1769,
              range: 400,
              heading: 315,
              tilt: 30,
            },
            eixample: {
              name: 'Eixample District',
              lat: 41.3935,
              lng: 2.1644,
              range: 800,
              heading: 25,
              tilt: 30,
            },
          };

          // Priority 1: Use address geocoding if provided
          if (address) {
            const geocoded = await geocodeAddress(address);

            if (geocoded) {
              // Check if coordinates are within coverage area
              const inBounds = (
                geocoded.lat >= 41.375 && geocoded.lat <= 41.412 &&
                geocoded.lng >= 2.142 && geocoded.lng <= 2.187
              );

              return {
                status: 'success',
                action: 'jump_to_location',
                location_name: geocoded.formatted_address,
                in_coverage: inBounds,
                camera: {
                  lat: geocoded.lat,
                  lng: geocoded.lng,
                  range: 400,  // Closer zoom for specific addresses
                  heading: 0,
                  tilt: 30,
                  roll: 0,
                },
                message: inBounds
                  ? `Navigating to ${geocoded.formatted_address}...`
                  : `Jumping to ${geocoded.formatted_address} (outside network coverage - street overlay will not be visible)`,
              };
            } else {
              // Geocoding failed
              return {
                status: 'error',
                action: 'jump_to_location',
                message: `Could not geocode address "${address}". Please try a different address or use a predefined location.`,
              };
            }
          }

          // Priority 2: Use custom coordinates if provided
          if (custom_lat && custom_lng) {
            // Check if coordinates are within coverage area
            const inBounds = (
              custom_lat >= 41.375 && custom_lat <= 41.412 &&
              custom_lng >= 2.142 && custom_lng <= 2.187
            );

            return {
              status: 'success',
              action: 'jump_to_location',
              location_name: 'Custom Location',
              in_coverage: inBounds,
              camera: {
                lat: custom_lat,
                lng: custom_lng,
                range: 800,
                heading: 0,
                tilt: 30,
                roll: 0,
              },
              message: inBounds
                ? `Jumping to custom coordinates: ${custom_lat.toFixed(4)}, ${custom_lng.toFixed(4)}`
                : `Jumping to ${custom_lat.toFixed(4)}, ${custom_lng.toFixed(4)} (outside network coverage - street overlay will not be visible)`,
            };
          } else if (location && locations[location as keyof typeof locations]) {
            const loc = locations[location as keyof typeof locations];
            return {
              status: 'success',
              action: 'jump_to_location',
              location_name: loc.name,
              in_coverage: true,
              camera: {
                lat: loc.lat,
                lng: loc.lng,
                range: loc.range,
                heading: loc.heading,
                tilt: loc.tilt,
                roll: 0,
              },
              message: `Navigating to ${loc.name}...`,
            };
          }

          // Default to Eixample center if nothing specified
          return {
            status: 'success',
            action: 'jump_to_location',
            location_name: 'Eixample District',
            in_coverage: true,
            camera: {
              lat: 41.3935,
              lng: 2.1644,
              range: 800,
              heading: 25,
              tilt: 30,
              roll: 0,
            },
            message: 'Returning to Eixample District center (default view).',
          };
        },
      },
      analyze_network: {
        description: 'Analyze the street network, parking infrastructure, and EV facilities to get real statistics and locations. Use this to answer questions about bicycle lanes, green spaces, parking availability, EV charging stations, etc.',
        inputSchema: z.object({
          analysis_type: z.enum(['lanes', 'parking', 'ev_parking', 'charging_stations']).optional()
            .describe('Type of analysis: lanes (default - street lanes), parking (general parking), ev_parking (EV parking zones), charging_stations (EV charging points)'),
          map_name: z.string().optional()
            .describe('Name of the data to analyze. For lanes: "cycling_corridor", "initial_network", "all_superblocks". For parking/EV: "onstreet_parking", "onstreet_parking_EV", "charging_stations". Defaults based on analysis_type.'),
          lane_type_filter: z.enum(['M', 'L', 'G', 'T', 'R']).optional()
            .describe('For lane analysis only - filter by type: M=Motor, L=Bicycle, G=Green spaces, T=Transit, R=Parking'),
        }),
        execute: async ({ analysis_type, map_name, lane_type_filter }) => {
          // Set defaults based on analysis type
          const analysisTypeValue = analysis_type || 'lanes';
          let mapNameValue = map_name;

          // Auto-select appropriate map if not specified
          if (!mapNameValue) {
            switch (analysisTypeValue) {
              case 'parking':
                mapNameValue = 'onstreet_parking';
                break;
              case 'ev_parking':
                mapNameValue = 'onstreet_parking_EV';
                break;
              case 'charging_stations':
                mapNameValue = 'charging_stations';
                break;
              default:
                mapNameValue = 'initial_network';
            }
          }

          // Analyze the network/infrastructure
          const analysis = await analyzeNetwork(mapNameValue, analysisTypeValue, lane_type_filter);

          return {
            status: 'success',
            action: 'analyze_network',
            ...analysis,
          };
        },
      },
      micro_transformation: {
        description: 'Apply MICRO level transformations to add EV parking and charging infrastructure. This keeps the base network unchanged but adds overlay layers for electric vehicle parking zones and charging stations.',
        inputSchema: z.object({
          transformation_type: z.enum(['add_ev_parking', 'add_charging_stations', 'full_ev_infrastructure'])
            .describe('Type of micro transformation: add_ev_parking (EV parking zones only), add_charging_stations (charging points only), or full_ev_infrastructure (both EV parking and charging stations)'),
        }),
        execute: async ({ transformation_type }) => {
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 4000));

          // Map transformation type to overlay configuration
          const transformations = {
            add_ev_parking: {
              mapState: {
                baseNetwork: 'initial_network',
                overlays: ['onstreet_parking_EV'],
              },
              features_added: { ev_parking_zones: 20 },
              message: 'EV parking added: 20 zones.',
            },
            add_charging_stations: {
              mapState: {
                baseNetwork: 'initial_network',
                overlays: ['charging_stations'],
              },
              features_added: { charging_stations: 12 },
              message: 'EV charging added: 12 stations.',
            },
            full_ev_infrastructure: {
              mapState: {
                baseNetwork: 'initial_network',
                overlays: ['onstreet_parking_EV', 'charging_stations'],
              },
              features_added: { ev_parking_zones: 20, charging_stations: 12 },
              message: 'EV infrastructure added: 20 parking zones, 12 charging stations.',
            },
          };

          const result = transformations[transformation_type as keyof typeof transformations];

          return {
            status: 'success',
            action: 'micro_transformation',
            transformation_type,
            ...result,
          };
        },
      },
      design_parking: {
        description: 'Design parking spots for Zürich with custom widths and safety margins using the goNEON backend calculator. This MICRO-level tool recalculates parking geometries based on design rules.',
        inputSchema: z.object({
          parking_spot_width: z.number().min(2.0).max(4.0).optional()
            .describe('Width of parking spots in meters (2.0-4.0m, default: 2.0m)'),
          dooring_margin: z.number().min(0.5).max(2.0).optional()
            .describe('Safety margin for car door opening in meters (0.5-2.0m, default: 1.5m)'),
        }),
        execute: async ({ parking_spot_width, dooring_margin }) => {
          try {
            // Build rules array for backend API
            const rules: any[] = [];

            if (parking_spot_width) {
              rules.push({
                ontology: 'ParkingSpot',
                attribute: 'parking_spot_width',
                value_min: parking_spot_width,
                value_max: parking_spot_width,
              });
            }

            if (dooring_margin) {
              rules.push({
                ontology: 'ParkingSpot',
                attribute: 'dooring_margin',
                value_min: dooring_margin,
                value_max: dooring_margin,
              });
            }

            // Call backend API
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${backendUrl}/design`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ rules }),
            });

            if (!response.ok) {
              throw new Error(`Backend API returned ${response.status}`);
            }

            const data = await response.json();

            // Add styling properties to GeoJSON features for proper rendering
            if (data.parking_spots?.features) {
              data.parking_spots.features = data.parking_spots.features.map((feature: any) => ({
                ...feature,
                properties: {
                  ...feature.properties,
                  type: 'parking',
                  color: '#00F0FF',
                  fill_opacity: 0.9,
                  stroke_width: 2
                }
              }));
            }

            if (data.remaining_roadway_widths?.features) {
              data.remaining_roadway_widths.features = data.remaining_roadway_widths.features.map((feature: any) => ({
                ...feature,
                properties: {
                  ...feature.properties,
                  color: '#FFA500',
                  stroke_width: 4
                }
              }));
            }

            // Save GeoJSON files to public/data/zürich/
            const fs = await import('fs/promises');
            const path = await import('path');

            const zurichDir = path.join(process.cwd(), 'public', 'data', 'zürich');

            // Ensure directory exists
            await fs.mkdir(zurichDir, { recursive: true });

            // Save the three GeoJSON files
            if (data.parking_spots) {
              await fs.writeFile(
                path.join(zurichDir, 'parking_spots.geojson'),
                JSON.stringify(data.parking_spots, null, 2)
              );
            }

            if (data.safety_margins) {
              await fs.writeFile(
                path.join(zurichDir, 'safety_margins.geojson'),
                JSON.stringify(data.safety_margins, null, 2)
              );
            }

            if (data.remaining_roadway_widths) {
              await fs.writeFile(
                path.join(zurichDir, 'remaining_roadway_width.geojson'),
                JSON.stringify(data.remaining_roadway_widths, null, 2)
              );
            }

            // Count features
            const parkingSpotsCount = data.parking_spots?.features?.length || 0;
            const remainingWidthsCount = data.remaining_roadway_widths?.features?.length || 0;

            return {
              status: 'success',
              action: 'design_parking',
              parking_spot_width: parking_spot_width || 2.0,
              dooring_margin: dooring_margin || 1.5,
              features_updated: {
                parking_spots: parkingSpotsCount,
                remaining_widths: remainingWidthsCount,
              },
              mapState: {
                baseNetwork: 'zürich/curbs',
                overlays: ['zürich/parking_spots', 'zürich/remaining_roadway_width'],
              },
              message: `Parking design updated: ${parkingSpotsCount} spots with ${parking_spot_width || 2.0}m width and ${dooring_margin || 1.5}m safety margin.`,
            };
          } catch (error) {
            console.error('Design parking error:', error);
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            return {
              status: 'error',
              action: 'design_parking',
              message: `Failed to connect to goNEON backend: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure the backend server is running on ${backendUrl}`,
            };
          }
        },
      },
      suggest_beta_booking: {
        description: 'Suggest the user to book a beta demo call with goNEON to explore more features and get personalized assistance. Use this after the user has made 4+ prompts to encourage them to learn more about the full platform.',
        inputSchema: z.object({
          message: z.string().optional()
            .describe('Optional custom message to accompany the booking suggestion'),
        }),
        execute: async ({ message }) => {
          return {
            status: 'success',
            action: 'suggest_beta_booking',
            redirect_url: 'https://goneon.city/after_prompting',
            message: message || 'Great exploration! Ready to see what goNEON can do for your city? Book a beta demo call with our team.',
          };
        },
      },
    },
    system: `You are N!, goNEON's AI agent for parking design and street space optimization.

**Your Mission**: Help planners design and optimize on-street parking in **minutes instead of weeks** through intelligent automated calculations.

**Demo Focus: Zürich Parking Design**:

This demo showcases MICRO-level parking design capabilities using real street data from Zürich, Switzerland. You can:
- Adjust parking spot widths (2.0m - 4.0m)
- Modify safety margins for car door opening (0.5m - 2.0m)
- Visualize how design changes affect available street space
- See remaining roadway widths in real-time

🌍 **Geographic Coverage Area**
- Current parking data covers: Central Zürich, Switzerland
- Focused area around coordinates: 47.388°N, 8.548°E
- 527 on-street parking spots with detailed geometry
- Real curb data and street measurements
- **IMPORTANT**: This demo focuses on a specific street segment in Zürich with detailed parking data

🛠️ **goNEON Parking Design Capabilities**
- Precise parking geometry calculation based on design constraints
- Real-time validation of street space allocation
- Visualization of remaining roadway widths
- Impact assessment of different parking configurations
- Integration with actual street measurements and curb data

📊 **Current Parking Data (Zürich)**
The loaded parking data contains:
- Total parking spots: 527 on-street spaces
- Street segment: Central Zürich area
- Measurements: Width, position, orientation for each spot
- Validation: Remaining roadway width calculated for each configuration
- Real curb data: Actual street boundaries and measurements

💬 **Communication Style**
- Keep responses to 2-3 sentences maximum
- Be warm, engaging, and conversational
- Use 1-2 relevant emojis sparingly when they add warmth (e.g., 🚴, 🌳, 📍, ✨)
- Provide helpful context and insights when users ask questions
- Balance being informative with staying concise
- Celebrate successes and invite exploration

🎯 **What You Can Do**
- **Design parking layouts**: Adjust spot widths and safety margins
- **Visualize impact**: See how changes affect remaining street space
- **Validate designs**: Identify spots that leave insufficient roadway width
- **Explore options**: Test different parking configurations instantly

🔧 **Primary Tool**
You have access to the parking design tool:
- 'design_parking' - Design parking spots with custom dimensions for Zürich (MICRO level):
  * Recalculates parking geometries using the goNEON backend calculator
  * Parameters: parking_spot_width (2.0-4.0m, default 2.0m), dooring_margin (0.5-2.0m, default 1.5m)
  * Updates parking spots, safety margins, and remaining roadway width visualizations
  * Use this when users want to adjust parking spot sizes or safety margins in Zürich
  * Example: "make parking spots 2.5 meters wide" or "increase dooring margin to 1.0 meter"
  * Requires the goNEON backend server running on http://localhost:8000

**Important Tool Execution**:

**BEFORE Executing the Tool**:
- First, briefly explain what you're about to do (1 sentence)
- Build anticipation and show your thinking process
- Make it engaging and enthusiastic
- Example: "Perfect! I'll recalculate the parking layout with 2.5m spots and 1.0m safety margins 🅿️ Let me update the design..."
- THEN execute the tool immediately

**AFTER Tool Execution**:
- Celebrate the success with warmth and personality (2-3 sentences max)
- Include 1-2 relevant emojis when appropriate
- Acknowledge the accomplishment and invite exploration
- Example: "Success! Updated 527 parking spots with your new dimensions 🅿️ Check out how the remaining street widths changed!"

**When Answering Follow-Up Questions**:
- Be helpful and provide context while staying concise
- Use relevant emojis sparingly to add warmth
- Example: "With 3.0m parking spots, many locations show narrow remaining roadway widths (< 2.5m) 🚗 This helps visualize the space tradeoffs!"

Always provide helpful, accurate information about parking design, street space allocation, and the goNEON platform capabilities.`,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
  });
}