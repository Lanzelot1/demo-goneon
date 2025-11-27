# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Next.js web interface for goNEON Core - an AI-powered parking design and street space optimization platform. Features a split-view layout with conversational AI chat (left) and 3D Google Maps visualization (right).

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (also checks TypeScript)
npm run lint         # Run ESLint
```

## Environment Variables

Create `.env.local`:
```
OPENAI_API_KEY=your_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
NEXT_PUBLIC_API_URL=http://localhost:8000  # goNEON backend
```

## Architecture

**Tech Stack**: Next.js 16 (App Router), React 19, Vercel AI SDK v5 with Anthropic, Google Maps 3D, Tailwind CSS v4, shadcn/ui

### Key Data Flow

1. **Chat → AI Tools → Map Updates**:
   - User sends message via `ChatInterface` → POST `/api/chat`
   - AI (Claude) decides to call tools like `design_parking`
   - Tool executes, returns `mapState` object with `baseNetwork` + `overlays`
   - `ChatInterface` extracts tool output, calls `onMapChange(mapState)`
   - `MapWidget` receives new state, triggers `GoogleMap3D` re-render

2. **GeoJSON Data Flow**:
   - Static GeoJSON files in `public/data/Maps/` (Barcelona network data)
   - Dynamic parking design: `design_parking` tool calls backend, stores result in `geojsonCache`
   - Frontend fetches via `/api/geojson-data?sessionId=xxx`

### Core Files

- `src/app/page.tsx` - Main layout, manages `MapState` and camera updates
- `src/app/api/chat/route.ts` - AI chat endpoint with all tool definitions
- `src/components/chat/chat-interface.tsx` - Chat UI, processes tool outputs
- `src/components/maps/map-widget.tsx` - Map container with particle effects
- `src/components/maps/google-map-3d.tsx` - Google Maps 3D wrapper with network overlay

### MapState Interface

```typescript
interface MapState {
  baseNetwork: string;      // e.g., "zürich/curbs"
  overlays: string[];       // e.g., ["zürich/parking_spots"]
  timestamp?: number;
}
```

### AI Tools (defined in `/api/chat/route.ts`)

| Tool | Purpose |
|------|---------|
| `design_parking` | MICRO: Recalculate parking with custom widths/margins via backend |
| `analyze_network` | Query lane/parking/EV statistics from GeoJSON |
| `jump_to_location` | Move camera to address or coordinates |
| `transform_network` | MACRO/MESO: Switch to cycling corridor or superblock networks |
| `micro_transformation` | Add EV parking/charging overlays |

### Adding New AI Tools

1. Add tool definition in `src/app/api/chat/route.ts` under `tools: { ... }`
2. Return `mapState` object to trigger map updates
3. Return `camera` object for location jumps
4. For large GeoJSON, use `geojsonCache` and return `sessionId`

## Styling Conventions

- Dark theme: black backgrounds, white/gray text
- Borders over fills: `border border-white/10`
- Use Tailwind utilities and shadcn/ui components
- Add new UI components: `npx shadcn@latest add <component>`

## Backend Integration

The `design_parking` tool requires goNEON backend running on `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`). It calls `POST /design` with parking rules and receives recalculated GeoJSON.
