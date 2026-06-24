# @adelv/web

Web plugins for [@adelv/adelv](https://www.npmjs.com/package/@adelv/adelv). Banner, native, video, and audio rendering; MRC viewability; click detection; and JavaScript tracker injection.

See [@adelv/gpt](https://www.npmjs.com/package/@adelv/gpt) for Google Publisher Tag integration.

## Install

```bash
npm install @adelv/adelv @adelv/web
```

## Plugins

### `banner(opts?)`

Renders display ads. Two shapes are supported:

- **Markup** — `ad.display.adm` rendered in a sandboxed iframe.
- **Structured image** — `ad.display.banner.img` rendered as an `<img>`, wrapped in an `<a href>` when `ad.display.banner.link.url` is set.

```typescript
import { createDelivery } from "@adelv/adelv"
import { banner } from "@adelv/web"

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

- `pending` → `adm` → iframe `srcdoc`; otherwise `banner.img` → `<img>` (+ `<a>` if linked)
- `onload` → transitions to `rendered`; `onerror` → transitions to `error`
- Cleanup removes the element from DOM

### `viewability(opts?)`

MRC viewability measurement using IntersectionObserver.

```typescript
import { viewability } from "@adelv/web"

delivery.use(viewability())

// Measure multiple MRC standards
delivery.use(viewability({
  standards: ["mrc50", "mrc100", "video50"],
}))
```

| Standard | Criteria | AdCOM EventType |
|---|---|---|
| `mrc50` (default) | 50% visible for 1s continuous | `VIEWABLE_MRC_50` |
| `mrc100` | 100% visible for 1s continuous | `VIEWABLE_MRC_100` |
| `video50` | 50% visible for 2s continuous | `VIEWABLE_VIDEO_50` |

- Starts observing after `rendered`
- Emits a `viewable` event carrying the met `standard`; each standard fires once
- Core maps the standard to its `EventType` and deduplicates per standard

### `native(opts)`

Native ad renderer. Delegates DOM construction to a user-provided render function.

```typescript
import { native } from "@adelv/web"
import { NativeDataAssetType } from "iab-adcom/enum"

delivery.use(native({
  render(target, ad) {
    const assets = ad.display!.native!.asset ?? []
    const link = ad.display!.native!.link

    const title = assets.find(a => a.title)?.title?.text ?? ""
    const img = assets.find(a => a.image)?.image?.url ?? ""
    const desc = assets.find(a => a.data?.type === NativeDataAssetType.DESCRIPTION)?.data?.value ?? ""
    const sponsor = assets.find(a => a.data?.type === NativeDataAssetType.SPONSORED)?.data?.value ?? ""

    target.innerHTML = `
      <a href="${link?.url ?? "#"}" class="native-ad">
        <img src="${img}" alt="${title}" />
        <h3>${title}</h3>
        <p>${desc}</p>
        <span class="sponsor">${sponsor}</span>
      </a>
    `

    return () => { target.innerHTML = "" }
  },
}))
```

- Skips if `ad.display?.native` is not present
- `render` function receives `(target: HTMLElement, ad: Ad)`
- Optionally return a cleanup function. Default cleanup: `target.innerHTML = ""`
- Errors in `render` transition to `error` state

### `video(opts)` / `audio(opts)`

Video (`ad.video`, VAST) and audio (`ad.audio`, DAAST) renderers. Like `native()`,
they delegate to a user render function — playback and in-stream tracking are the
external player's responsibility (the VAST/DAAST document carries its own trackers,
so these media have no AdCOM `event[]`).

```typescript
import { video } from "@adelv/web"

delivery.use(video({
  render(target, ad) {
    const player = mountVastPlayer(target, ad.video!.adm!)
    return () => player.destroy()
  },
}))
```

- Skips if `ad.video` (or `ad.audio`) is not present
- Same lifecycle and cleanup semantics as `native()`
- `burl` still fires on `rendered`; impression/viewability event[] do not apply

### `jsTracker(opts?)`

Injects `EventTrackingMethod.JAVASCRIPT` trackers from `ad.display.event` as
`<script>` tags. Core fires `IMAGE_PIXEL` trackers as beacons; this plugin
handles the JavaScript method.

```typescript
import { jsTracker } from "@adelv/web"

delivery.use(jsTracker())              // inject into the target element (default)
delivery.use(jsTracker({ mount: "head" }))  // or into document.head
```

- On `impression` (rendered): injects `LOADED` + `IMPRESSION` JS trackers
- On `viewable`: injects the JS tracker for the met standard's `EventType`
- Cleanup removes all injected scripts

### `click()`

Click detection for target elements and iframe focus.

```typescript
import { click } from "@adelv/web"

delivery.use(click())
```

- **Direct clicks**: Listens for `click` events on the target element (native ads)
- **Iframe clicks**: Detects via `window.blur` + `document.activeElement` heuristic (best effort)
- Landing URL is extracted from `ad.display.banner.link.url` or `ad.display.native.link.url`
- Starts after `rendered`

## Plugin Composition

Register rendering plugin first, then measurement plugins:

```typescript
delivery.use(banner())       // rendering plugin
delivery.use(viewability())  // measurement plugin
delivery.use(click())        // measurement plugin
delivery.use(jsTracker())    // measurement plugin
```

Only one rendering plugin per delivery (`banner()`, `native()`, `video()`, `audio()`, or `gpt()`). Multiple measurement plugins (`viewability()`, `click()`, `jsTracker()`) are fine.

## License

MIT
