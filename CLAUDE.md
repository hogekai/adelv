# adelv

Ad delivery library suite. Receives AdCOM Ad objects, delivers them, and tracks metrics.
Completely independent from trawl (collection). Zero dependencies between them.

## Monorepo Structure

```
adelv/
├── packages/
│   ├── adelv/          ← @adelv/adelv (delivery core, environment-agnostic)
│   ├── web/            ← @adelv/web (web plugins: banner, viewability, click)
│   └── gpt/            ← @adelv/gpt (GPT plugin)
├── instructions/        ← Phase-based implementation specs
├── package.json         ← Root (pnpm workspace)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
└── CLAUDE.md
```

## Commands

```bash
pnpm install              # Install dependencies
pnpm test                 # Run all package tests
pnpm typecheck            # Type-check all packages
pnpm build                # Build all packages
pnpm lint                 # Lint all packages
pnpm lint:fix             # Auto-fix lint issues across all packages
```

## Inter-package Dependencies

```
@adelv/adelv     → iab-adcom (AdCOM type definitions)
@adelv/web       → @adelv/adelv, iab-adcom
@adelv/gpt       → @adelv/adelv, iab-openrtb
```

Core (@adelv/adelv) does not depend on iab-openrtb. Transaction Layer type containment.

## Architecture

- Same structure as vide: createPlayer → createDelivery. State machine + event bus + plugins
- One slot = one delivery. Each delivery has exactly one rendering plugin
- Plugins are trusted code with the same privileges as core
- Core does not touch target. Rendering is the plugin's responsibility
- Core is environment-agnostic. Environment-specific logic is encapsulated in sub-packages

## Key Design Decisions

- DeliveryInput uses `burl` (billing notification), not `curl` (per OpenRTB 3.0 Bid spec)
- event[] comes from `ad.display?.event` only. Video/audio have no event field in the type definition
- Click trackers are obtained from LinkAsset.trkr[], not event[] (AdCOM EventType has no CLICK value)
- Tracking beacon failures do not affect state transitions
- Cleanup functions are synchronous only
- Only EventTrackingMethod.IMAGE_PIXEL is supported. JAVASCRIPT tracker is a future web-specific extension

## Type Sourcing

```typescript
// Core
import type { Ad, Display, Video, Audio, Event } from "iab-adcom/media"
import { EventType, EventTrackingMethod } from "iab-adcom/enum"

// gpt/gpt.ts only
import type { Bid, Seatbid } from "iab-openrtb/v30"
```

## State Machine

```
idle → pending → rendering → rendered → destroyed
                            → error    → destroyed
```

- viewable and clicked are events, not states
- Invalid transitions are logged via logger.warn and ignored
- setState to the same state is a no-op

## Tracking Fire Timing

| Timing | Fires |
|---|---|
| pending transition | purl |
| rendered transition | burl + IMPRESSION equivalent from event[] + auto-emit impression event |
| viewable event | VIEWABLE_MRC_50 equivalent from event[] (deduplicated, fires once only) |
| click event | LinkAsset.trkr[] (no guard, multiple fires OK) |
