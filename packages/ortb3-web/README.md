# @adelv/ortb3-web

Web plugins for [@adelv/ortb3](https://www.npmjs.com/package/@adelv/ortb3). Banner rendering, MRC viewability, click detection, and Google Publisher Tag integration.

## Install

```bash
npm install @adelv/ortb3 @adelv/ortb3-web
```

## Plugins

### `banner()`

Renders display ads via sandboxed iframe. Reads `ad.display.adm` markup.

```typescript
import { createDelivery } from "@adelv/ortb3"
import { banner } from "@adelv/ortb3-web"

const delivery = createDelivery(document.getElementById("ad-slot")!)
delivery.use(banner())
delivery.deliver({ ad, purl, burl })
```

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
import type { Bid } from "iab-openrtb/v30"

const delivery = createDelivery(document.getElementById("ad-slot")!)
delivery.use(gpt({
  adUnit: "/12345/header",
  sizes: [[728, 90], [970, 250]],
  bids: auctionBids,  // Optional. Sets hb_pb, hb_deal targeting.
}))
delivery.deliver({ ad, purl, burl })
```

- `pending` → defines GPT slot → `disableInitialLoad` → sets targeting → `refresh`
- `slotRenderEnded` → transitions to `rendered`
- Cleanup destroys the GPT slot and removes event listeners
- `enableServices()` is called once globally, not per slot

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
