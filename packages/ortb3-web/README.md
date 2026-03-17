# @adelv/ortb3-web

Web plugins for [@adelv/ortb3](https://www.npmjs.com/package/@adelv/ortb3). Banner rendering, MRC viewability, click detection, and Google Publisher Tag integration.

## Install

```bash
npm install @adelv/ortb3 @adelv/ortb3-web
```

## Plugins

### `banner(opts?)`

Renders display ads via sandboxed iframe. Reads `ad.display.adm` markup.

```typescript
import { createDelivery } from "@adelv/ortb3"
import { banner } from "@adelv/ortb3-web"

// Default usage
const delivery = createDelivery(document.getElementById("ad-slot")!)
delivery.use(banner())
delivery.deliver({ ad, purl, burl })

// With allow-same-origin for postMessage-based creatives
delivery.use(banner({
  sandbox: ["allow-scripts", "allow-same-origin", "allow-popups"],
}))

// Custom iframe attributes and style
delivery.use(banner({
  attrs: { loading: "lazy" },
  style: { width: "100%", height: "auto" },
}))

// Remove sandbox entirely (not recommended)
delivery.use(banner({ sandbox: null }))
```

Options:

| Option | Type | Default | Description |
|---|---|---|---|
| `sandbox` | `string[] \| null` | `["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"]` | iframe sandbox tokens. `null` removes sandbox. |
| `attrs` | `Record<string, string>` | — | Additional iframe attributes. |
| `style` | `Partial<CSSStyleDeclaration>` | `{ border: "none" }` | CSS styles. Merged with defaults. |

- `pending` → reads `ad.display.adm` → creates iframe with `srcdoc`
- `iframe.onload` → transitions to `rendered`
- `iframe.onerror` → transitions to `error`
- Cleanup removes iframe from DOM

### `viewability(opts?)`

MRC viewability measurement using IntersectionObserver.

```typescript
import { viewability } from "@adelv/ortb3-web"

delivery.use(viewability())

// Custom thresholds
delivery.use(viewability({
  threshold: 0.5,   // 50% area visible (default)
  duration: 1000,   // 1 second continuous (default)
}))
```

- Starts observing after `rendered`
- Emits `viewable` event once threshold is met for duration
- Core deduplicates: trackers fire once regardless of multiple emits

### `click()`

Click detection for target elements and iframe focus.

```typescript
import { click } from "@adelv/ortb3-web"

delivery.use(click())
```

- **Direct clicks**: Listens for `click` events on the target element (native ads)
- **Iframe clicks**: Detects via `window.blur` + `document.activeElement` heuristic (best effort)
- Landing URL is extracted from `ad.display.banner.link.url` or `ad.display.native.link.url`
- Starts after `rendered`

### `gpt(opts)`

Google Publisher Tag integration. Defines a slot, sets header bidding targeting, and renders via GPT.

```typescript
import { createDelivery } from "@adelv/ortb3"
import { gpt } from "@adelv/ortb3-web"

const delivery = createDelivery(document.getElementById("ad-slot")!)
delivery.use(gpt({
  adUnit: "/12345/header",
  sizes: [[728, 90], [970, 250]],
  bids: auctionBids,
  targeting: {
    hb_bidder: "ssp-a",
  },
}))
delivery.deliver({ ad, purl, burl })
```

Options:

| Option | Type | Description |
|---|---|---|
| `adUnit` | `string` | GAM ad unit path. |
| `sizes` | `[number, number][]` | Ad sizes. |
| `bids` | `Bid[]` | Optional. Auto-generates `hb_pb`, `hb_deal`, `hb_size` targeting. |
| `targeting` | `Record<string, string \| string[]>` | Optional. Direct key-values. Merged after auto-generated targeting (overrides on conflict). |

- `pending` → defines GPT slot → `disableInitialLoad` → sets targeting → `refresh`
- `slotRenderEnded` → transitions to `rendered`
- Cleanup destroys the GPT slot and removes event listeners
- `enableServices()` is called once globally, not per slot

#### `buildTargeting(bids)`

Utility to build GAM targeting from bids. Exported for composition.

```typescript
import { buildTargeting } from "@adelv/ortb3-web"

const kv = buildTargeting(bids)
// { hb_pb: "2.50", hb_deal: "deal-123", hb_size: "300x250" }
```

## Plugin Composition

Register rendering plugin first, then measurement plugins:

```typescript
delivery.use(banner())       // rendering plugin
delivery.use(viewability())  // measurement plugin
delivery.use(click())        // measurement plugin
```

Only one rendering plugin per delivery (`banner()` or `gpt()`). Multiple measurement plugins are fine.

## License

MIT
