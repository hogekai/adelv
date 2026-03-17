# @adelv/ortb3

OpenRTB 3.0 ad delivery core. Receives an AdCOM Ad object, delivers it, and fires all tracking beacons at the correct timing.

Environment-agnostic. No DOM dependency. Rendering and measurement are delegated to plugins.

## Install

```bash
npm install @adelv/ortb3
```

For web rendering plugins (banner, viewability, click, gpt):

```bash
npm install @adelv/ortb3-web
```

## Usage

```typescript
import { createDelivery } from "@adelv/ortb3"
import { banner, viewability, click } from "@adelv/ortb3-web"

const delivery = createDelivery(document.getElementById("ad-slot")!)
delivery.use(banner())
delivery.use(viewability())
delivery.use(click())

delivery.on("impression", ({ ts }) => console.log("impression", ts))
delivery.on("viewable", ({ ts }) => console.log("viewable", ts))
delivery.on("click", ({ ts, url }) => console.log("click", url, ts))
delivery.on("error", ({ message, source }) => console.error(source, message))

delivery.deliver({
  ad: bid.media,   // AdCOM Ad object
  purl: bid.purl,  // Pending notification URL
  burl: bid.burl,  // Billing notification URL
})
```

## State Machine

```
idle → pending → rendering → rendered → destroyed
                            → error    → destroyed
```

- `viewable` and `click` are events within `rendered`, not states.
- Invalid transitions are logged via `logger.warn` and ignored.
- Same-state `setState` calls are no-ops.

## Tracking

| Timing | Fires |
|---|---|
| pending | `purl` |
| rendered | `burl` + `event[]` IMPRESSION trackers |
| viewable | `event[]` VIEWABLE_MRC_50 trackers (once) |
| click | `LinkAsset.trkr[]` click trackers (every time) |

Beacon failure emits `error` event with `source: "tracking"`. State is unaffected.

## Custom Beacon

```typescript
import { createDelivery } from "@adelv/ortb3"
import type { BeaconSender } from "@adelv/ortb3"

const sendBeacon: BeaconSender = async (url) => {
  navigator.sendBeacon(url)
}

const delivery = createDelivery(element, { sendBeacon })
```

## Custom Plugins

```typescript
import type { DeliveryPlugin } from "@adelv/ortb3"

function myPlugin(): DeliveryPlugin<HTMLElement> {
  return {
    name: "my-plugin",
    setup(delivery, signal) {
      delivery.on("statechange", ({ to }) => {
        if (to === "rendered") {
          // React to rendered state
        }
      })
      return () => { /* cleanup */ }
    },
  }
}
```

## API

See [full documentation](https://github.com/hogekai/adelv#api) for complete API reference.

## License

MIT
