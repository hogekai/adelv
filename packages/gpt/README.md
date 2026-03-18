# @adelv/gpt

Google Publisher Tag integration plugin for [@adelv/adelv](https://www.npmjs.com/package/@adelv/adelv).

## Install

```bash
npm install @adelv/adelv @adelv/gpt
```

## Usage

```typescript
import { createDelivery } from "@adelv/adelv"
import { gpt } from "@adelv/gpt"

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

## Options

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

## `buildTargeting(bids)`

Utility to build GAM targeting key-values from OpenRTB 3.0 bids. Exported for custom composition.

```typescript
import { buildTargeting } from "@adelv/gpt"

const kv = buildTargeting(bids)
// { hb_pb: "2.50", hb_deal: "deal-123", hb_size: "300x250" }
```

## License

MIT
