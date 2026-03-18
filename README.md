# adelv

Ad delivery library. Receives AdCOM Ad objects, delivers them, and tracks metrics.

Completely independent from trawl (collection). Zero dependencies between them. Works with Prebid Server or any external bid source — just pass an AdCOM Ad object and tracking URLs.

## Packages

| Package | Description |
|---|---|
| [@adelv/adelv](./packages/adelv) | Ad delivery core. Environment-agnostic. |
| [@adelv/web](./packages/web) | Web plugins: banner, viewability, click |
| [@adelv/gpt](./packages/gpt) | Google Publisher Tag integration |

## Install

```bash
npm install @adelv/adelv @adelv/web

# GPT integration
npm install @adelv/gpt
```

## Quick Start

### Banner (without GPT)

```typescript
import { createDelivery } from "@adelv/adelv"
import { banner, viewability, click } from "@adelv/web"

const ad = createDelivery(document.getElementById("ad-slot")!)
ad.use(banner())
ad.use(viewability())
ad.use(click())

ad.on("impression", ({ ts }) => console.log("impression", ts))
ad.on("viewable", ({ ts }) => console.log("viewable", ts))
ad.on("click", ({ ts, url }) => console.log("click", url, ts))
ad.on("error", ({ message, source }) => console.error(source, message))

ad.deliver({
  ad: winnerBid.media,  // AdCOM Ad object
  purl: winnerBid.purl,
  burl: winnerBid.burl,
})
```

### With GPT

```typescript
import { createDelivery } from "@adelv/adelv"
import { gpt } from "@adelv/gpt"

const ad = createDelivery(document.getElementById("ad-slot")!)
ad.use(gpt({
  adUnit: "/12345/header",
  sizes: [[728, 90]],
  bids: auctionResult.bids,
}))

ad.deliver({
  ad: winnerBid.media,
  purl: winnerBid.purl,
  burl: winnerBid.burl,
})
```

### trawl + adelv

```typescript
// Collection (ortb3-trawl — separate product)
import { createAdSlots, imp, banner, auction, byPrice } from "ortb3-trawl"

const ads = createAdSlots(
  imp("header", banner([728, 90])),
  imp("sidebar", banner([300, 250])),
)
ads.demand("ssp-a", { endpoint: "https://ssp-a.com/bid" })
ads.demand("ssp-b", { endpoint: "https://ssp-b.com/bid" })

const result = await ads.bid()
const winners = auction(result.bids, byPrice())

// Delivery (@adelv/adelv — knows nothing about trawl)
import { createDelivery } from "@adelv/adelv"
import { banner as bannerPlugin, viewability, click } from "@adelv/web"

const headerBid = winners.get("header")
if (headerBid) {
  const headerAd = createDelivery(document.getElementById("ad-header")!)
  headerAd.use(bannerPlugin())
  headerAd.use(viewability())
  headerAd.use(click())
  headerAd.deliver({
    ad: headerBid.media,
    purl: headerBid.purl,
    burl: headerBid.burl,
  })
}
```

## State Machine

```
idle → pending → rendering → rendered → destroyed
                            → error    → destroyed
```

| State | Description |
|---|---|
| idle | Initial. No DeliveryInput. |
| pending | DeliveryInput received. Waiting for render. |
| rendering | Plugin is rendering the ad. |
| rendered | Render complete. Stable state. |
| error | Render failed. |
| destroyed | Disposed. Terminal. |

`viewable` and `click` are events, not states. They occur independently within `rendered`.

## Tracking

All tracking URLs fire automatically at the correct timing.

| Timing | Fires |
|---|---|
| pending | `purl` (pending notification) |
| rendered | `burl` (billing notification) + `event[]` IMPRESSION trackers |
| viewable event | `event[]` VIEWABLE_MRC_50 trackers (once only) |
| click event | `LinkAsset.trkr[]` click trackers (every click) |

Beacon failure does not affect state transitions. An `error` event with `source: "tracking"` is emitted.

## Custom Plugins

```typescript
import type { DeliveryPlugin } from "@adelv/adelv"

function myPlugin(): DeliveryPlugin<HTMLElement> {
  return {
    name: "my-plugin",
    setup(delivery, signal) {
      delivery.on("statechange", ({ to }) => {
        if (to === "rendered") {
          // Do something when rendered
        }
      })

      // Return cleanup function (sync only)
      return () => {
        // Cleanup resources
      }
    },
  }
}
```

Plugins are trusted code with full access via `PluginDelivery`:

- `setState(state)` — Trigger state transitions
- `emit(event, data)` — Fire events (viewable, click, etc.)
- `on(event, handler)` / `off(event, handler)` — Listen to events
- `target` — The delivery target (e.g., HTMLElement)
- `input` — The DeliveryInput
- `signal` (setup arg) — AbortSignal. Aborted on rendering timeout or destroy.

## Custom Beacon

```typescript
import { createDelivery } from "@adelv/adelv"
import type { BeaconSender } from "@adelv/adelv"

const sendBeacon: BeaconSender = async (url) => {
  navigator.sendBeacon(url)
}

const ad = createDelivery(element, { sendBeacon })
```

## API

### `createDelivery<T>(target: T, options?: DeliveryOptions): Delivery<T>`

Create a delivery instance for a single ad slot.

### `DeliveryInput`

```typescript
interface DeliveryInput {
  ad: Ad          // AdCOM Ad object
  purl?: string   // Pending notification URL
  burl?: string   // Billing notification URL
}
```

### `DeliveryOptions`

```typescript
interface DeliveryOptions {
  renderingTimeout?: number                    // Default: 5000ms
  logger?: { warn(message: string): void }     // Default: console.warn
  sendBeacon?: (url: string) => Promise<void>  // Default: fetch GET
}
```

### `Delivery<T>`

```typescript
interface Delivery<T> {
  readonly target: T
  readonly state: DeliveryState
  readonly input: DeliveryInput | null
  use(plugin: DeliveryPlugin<T>): void
  deliver(input: DeliveryInput): void
  on(event, handler): void
  off(event, handler): void
  destroy(): void
}
```

### `DeliveryPlugin<T>`

```typescript
interface DeliveryPlugin<T> {
  name: string
  setup(delivery: PluginDelivery<T>, signal: AbortSignal): (() => void) | undefined
}
```

### Web Plugins

| Plugin | Description |
|---|---|
| `banner()` | Renders display ads via iframe. `DeliveryPlugin<HTMLElement>` |
| `viewability(opts?)` | MRC viewability measurement. threshold (default 0.5), duration (default 1000ms) |
| `click()` | Click detection for target elements and iframe focus. |
| `gpt(opts)` | Google Publisher Tag integration. See [@adelv/gpt](./packages/gpt). |

## License

MIT
