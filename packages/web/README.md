# @adelv/web

Web plugins for [@adelv/adelv](https://www.npmjs.com/package/@adelv/adelv). Banner rendering, native ad rendering, MRC viewability, and click detection.

See [@adelv/gpt](https://www.npmjs.com/package/@adelv/gpt) for Google Publisher Tag integration.

## Install

```bash
npm install @adelv/adelv @adelv/web
```

## Plugins

### `banner(opts?)`

Renders display ads via sandboxed iframe. Reads `ad.display.adm` markup.

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

- `pending` → reads `ad.display.adm` → creates iframe with `srcdoc`
- `iframe.onload` → transitions to `rendered`
- `iframe.onerror` → transitions to `error`
- Cleanup removes iframe from DOM

### `viewability(opts?)`

MRC viewability measurement using IntersectionObserver.

```typescript
import { viewability } from "@adelv/web"

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
```

Only one rendering plugin per delivery (`banner()`, `native()`, or `gpt()`). Multiple measurement plugins are fine.

## License

MIT
