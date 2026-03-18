# @adelv/adelv

Ad delivery core. Receives an AdCOM Ad object, delivers it, and fires all tracking beacons at the correct timing.

Environment-agnostic. No DOM dependency. Rendering and measurement are delegated to plugins.

## Install

```bash
npm install @adelv/adelv
```

For web rendering plugins (banner, viewability, click):

```bash
npm install @adelv/web
```

For GPT integration:

```bash
npm install @adelv/gpt
```

## Usage

```typescript
import { createDelivery } from "@adelv/adelv"
import { banner, viewability, click } from "@adelv/web"

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
import { createDelivery } from "@adelv/adelv"
import type { BeaconSender } from "@adelv/adelv"

const sendBeacon: BeaconSender = async (url) => {
  navigator.sendBeacon(url)
}

const delivery = createDelivery(element, { sendBeacon })
```

## Consent

Wrap the beacon sender with consent checking:

```typescript
import { createDelivery, withConsent } from "@adelv/adelv"

const delivery = createDelivery(element, {
  sendBeacon: withConsent(() => {
    // Return true if consent is granted
    return window.__tcfapiConsentGranted === true
  }),
})
```

When consent is denied:
- Beacons are not fired
- An `error` event with `source: "tracking"` is emitted
- State transitions are unaffected (ads still render)

Combine with a custom sender:

```typescript
import { withConsent } from "@adelv/adelv"

const sender = withConsent(
  () => hasConsent(),
  async (url) => navigator.sendBeacon(url),
)

const delivery = createDelivery(element, { sendBeacon: sender })
```

## Custom Plugins

```typescript
import type { DeliveryPlugin } from "@adelv/adelv"

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
