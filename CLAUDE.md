# CLAUDE.md - Demo Web Interface

This file provides guidance to Claude Code when working with the demo-web Next.js application.

## Overview

The demo-web application is a Next.js-based web interface for goNEON Core, providing an interactive chat interface with AI-powered street network tools and 3D map visualization. It demonstrates the capabilities of the SNTwin platform through a conversational UI with real-time network transformations.

## Quick Start

### Development Commands
```bash
# Navigate to demo-web directory
cd demo-web

# Install dependencies
npm install

# Run development server (starts on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Environment Setup
Create a `.env.local` file in the demo-web directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router with React 19)
- **AI Integration**: Vercel AI SDK v5 with OpenAI
- **Maps**: Google Maps JavaScript API via @vis.gl/react-google-maps
- **UI Components**: Radix UI primitives + shadcn/ui
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion
- **Type Safety**: TypeScript

### Project Structure

```
demo-web/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/
│   │   │   ├── chat/            # AI chat endpoint with tools
│   │   │   │   └── route.ts     # Streaming chat with network tools
│   │   │   └── network-data/    # Network data endpoint
│   │   │       └── route.ts     # Serves GeoJSON from GIS directory
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Main demo page (chat + map split view)
│   │
│   └── components/
│       ├── ai-elements/         # AI-specific UI components
│       │   ├── ai-assistant-message.tsx    # Assistant message renderer
│       │   ├── ai-user-message.tsx         # User message bubble
│       │   ├── ai-tool-call.tsx           # Tool execution display
│       │   └── ai-tool-result.tsx         # Tool result display
│       │
│       ├── chat/                # Chat interface components
│       │   └── chat-interface.tsx    # Main chat component
│       │
│       ├── layout/              # Layout components
│       │   └── header.tsx       # Application header
│       │
│       ├── maps/                # Map components
│       │   ├── map-widget.tsx           # Map container with network loading
│       │   ├── google-map-3d.tsx        # Google Maps wrapper
│       │   ├── network-overlay.tsx      # GeoJSON network renderer
│       │   └── polyline-3d.tsx          # 3D polyline component
│       │
│       └── ui/                  # shadcn/ui components
│           └── [various].tsx    # Button, Card, Input, etc.
│
├── public/                      # Static assets
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── next.config.ts              # Next.js configuration
```

## Key Features

### 1. AI Chat Interface (`src/app/api/chat/route.ts`)

The chat endpoint uses Vercel AI SDK v5 with streaming and tool calling:

**Available Tools:**
- `reset_network` - Reset network to initial motor vehicle state
  - Returns: 3,030 total motor lanes

- `transform_network` - Apply street network transformations
  - Parameters:
    - `transformation_type`: 'superblock' | 'cycling_corridor' | 'all_superblocks'
    - `intensity`: Optional 0-1 intensity value
  - Each transformation returns different lane distributions and triggers map updates

**Tool Execution Flow:**
1. User sends message requesting transformation
2. AI decides if tool use is needed
3. Tool executes (with 4s simulated processing)
4. Result includes `map` field that triggers map data reload
5. AI provides conversational explanation of results

### 2. Map Visualization (`src/components/maps/`)

**Map Widget (`map-widget.tsx`)**
- Fetches GeoJSON data from `/api/network-data?map={mapName}`
- Loads network data from `../../GIS/{mapName}.geojson`
- Updates when `currentMap` prop changes
- Handles loading states and errors

**Network Overlay (`network-overlay.tsx`)**
- Renders GeoJSON LineString features as 3D polylines
- Color coding by lane type:
  - Motor lanes: Gray (#9CA3AF)
  - Bicycle lanes: Green (#10B981)
  - Green spaces: Emerald (#34D399)
  - Mixed/other: Amber (#F59E0B)
- Uses Google Maps 3D capabilities for elevation and tilt

**Google Map 3D (`google-map-3d.tsx`)**
- Wrapper around @vis.gl/react-google-maps
- Centered on Madrid, Spain by default (40.4168, -3.7038)
- 3D tilt enabled (45° default heading)
- Zoom level: 15

### 3. Chat UI Components (`src/components/ai-elements/`)

**Message Flow:**
- User messages: Simple text bubbles with blue border
- Assistant messages: Markdown-rendered with syntax highlighting
- Tool calls: Collapsible cards showing tool name and parameters
- Tool results: JSON-formatted results in collapsible sections

**Styling Theme:**
- Black background throughout
- White/gray text
- Colored borders (blue for user, green for assistant)
- Border-based cards instead of filled backgrounds
- Mono-width font for code/JSON

## Integration with Python Backend

### Network Data Flow

1. **Python SNTwin** creates and transforms networks
   - Saves GeoJSON to `GIS/` directory at project root
   - Files named: `initial_network.geojson`, `one_superblock.geojson`, etc.

2. **Next.js API Route** (`/api/network-data`) serves these files
   ```typescript
   // Reads from ../../GIS/{mapName}.geojson
   const gisDir = path.join(process.cwd(), '..', 'GIS');
   ```

3. **Map Widget** fetches and renders the GeoJSON
   - Uses Google Maps Polyline3D for rendering
   - Applies color coding based on lane properties

### Expected GeoJSON Structure

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[lng, lat], [lng, lat], ...]
      },
      "properties": {
        "osm_id": "123",
        "osm_name": "Street Name",
        "lanes": 4,
        "lane_type": "M",  // M=Motor, L=Bicycle, G=Green, T=Transit
        "width": 12.5,
        // ... other properties
      }
    }
  ]
}
```

## Development Guidelines

### Adding New AI Tools

1. Add tool definition to `src/app/api/chat/route.ts`:
```typescript
tools: {
  your_tool_name: {
    description: 'Tool description for AI',
    inputSchema: z.object({
      param1: z.string().describe('Parameter description'),
    }),
    execute: async ({ param1 }) => {
      // Tool implementation
      return {
        status: 'success',
        map: 'map_name',  // Optional: triggers map update
        // ... other data
      };
    },
  },
}
```

2. Update system prompt to document the tool
3. Test with relevant user queries

### Adding New Map Types

1. Generate GeoJSON from Python:
```python
from apps.sntwin.agent_tools import call_tool
# ... transform network ...
# Save to GIS/your_map_name.geojson
```

2. Tool should return `map: 'your_map_name'` in result
3. Map widget automatically fetches new data

### Styling Conventions

- **Colors**: Use Tailwind utility classes
- **Borders**: Prefer `border border-white/10` over background fills
- **Spacing**: Use consistent padding (p-4, p-6, etc.)
- **Text**: Use `text-white`, `text-gray-400` for hierarchy
- **Animations**: Use Framer Motion for transitions
- **Responsive**: Always consider mobile (md: breakpoints)

### Component Patterns

1. **Server Components** by default (App Router)
2. **Client Components** when needed:
   - `"use client"` directive at top
   - Use for interactivity, hooks, browser APIs
3. **API Routes** for backend logic
   - Use `route.ts` naming
   - Export POST, GET, etc.

## Common Tasks

### Update Map Center Location
Edit `src/components/maps/google-map-3d.tsx`:
```typescript
const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 }; // Madrid
```

### Change AI Model
Edit `src/app/api/chat/route.ts`:
```typescript
model: openai('gpt-4o-mini'),  // or 'gpt-4o', 'gpt-4-turbo', etc.
```

### Add UI Components
Use shadcn/ui CLI:
```bash
npx shadcn@latest add button
npx shadcn@latest add card
# etc.
```

### Modify Chat Layout
Edit `src/app/page.tsx`:
- Chat width: `w-full md:w-1/3`
- Map width: `md:w-2/3`

## Important Notes

- **API Keys**: Never commit `.env.local` to git
- **CORS**: API routes are same-origin, no CORS issues
- **GIS Directory**: Shared with Python backend at `../GIS/`
- **Hot Reload**: Dev server watches for file changes
- **Build Output**: `.next/` directory (gitignored)
- **Node Modules**: Large directory (gitignored), reinstall with `npm install`
- **Type Safety**: Run `npm run build` to check for TypeScript errors

## Troubleshooting

### Map Not Loading
- Check Google Maps API key in `.env.local`
- Verify GeoJSON file exists in `GIS/` directory
- Check browser console for network errors
- Ensure GeoJSON is valid (use geojson.io to validate)

### Chat Not Responding
- Check OpenAI API key in `.env.local`
- Verify API route is running (check terminal for errors)
- Check browser Network tab for failed requests
- Review rate limits on OpenAI account

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Check TypeScript errors with `npm run build`
- Clear `.next/` directory: `rm -rf .next/`
- Check Node version compatibility (requires Node 18+)

## Dependencies Reference

### Core Dependencies
- `next@16.0.0` - React framework
- `react@19.2.0` - UI library
- `ai@5.0.81` - Vercel AI SDK
- `@ai-sdk/openai@2.0.53` - OpenAI provider
- `@vis.gl/react-google-maps@1.6.1` - Google Maps components

### UI Dependencies
- `@radix-ui/*` - Accessible UI primitives
- `lucide-react@0.548.0` - Icon library
- `framer-motion@12.23.24` - Animation library
- `tailwindcss@4` - Utility-first CSS

### Development Tools
- `typescript@5` - Type safety
- `eslint@9` - Code linting
- `@types/*` - TypeScript definitions

## Future Enhancements

Potential areas for expansion:
- Real-time network updates via WebSockets
- Multiple map comparison views
- Network statistics dashboard
- User authentication and saved networks
- Export functionality (PDF reports, data downloads)
- Advanced 3D visualization (buildings, terrain)
- Integration with Python backend via REST API
