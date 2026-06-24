# @adelv/adelv

## 0.2.0

### Minor Changes

- 88e6b38: Expand AdCOM spec coverage.

  **@adelv/adelv**

  - Fire `LOADED` event trackers on the `rendered` transition (alongside `IMPRESSION`).
  - `viewable` events now carry a `ViewableStandard` (`mrc50` | `mrc100` | `video50`); core maps each to its AdCOM `EventType` (`VIEWABLE_MRC_50` / `VIEWABLE_MRC_100` / `VIEWABLE_VIDEO_50`) and deduplicates **per standard**. Dedup moved from the event bus into the delivery domain layer.
  - `getEventUrls(ad, type, method?)` now takes an `EventTrackingMethod` (default `IMAGE_PIXEL`); `getEventUrls`, `viewableEventType`, and the `ViewableStandard` type are exported for plugins.

    **BREAKING:** the `viewable` event payload changed from `{ ts }` to `{ ts, standard }`.

  **@adelv/web**

  - `viewability({ standards })` measures multiple MRC standards (`mrc50` 50%/1s, `mrc100` 100%/1s, `video50` 50%/2s).

    **BREAKING:** the `threshold`/`duration` options were replaced by `standards` (default `["mrc50"]`).

  - New `video()` and `audio()` plugins render `ad.video` / `ad.audio` (VAST/DAAST) by delegating to a user render function (shared with `native()`).
  - New `jsTracker()` plugin injects `EventTrackingMethod.JAVASCRIPT` trackers as `<script>` tags.
  - `banner()` now also renders structured image creatives (`ad.display.banner.img`), wrapping in an `<a>` when a link is present.

  **@adelv/gpt**

  - `gpt()` now emits an `error` (instead of failing silently) when the delivery target has no `id`.

## 0.1.1

### Patch Changes

- Fix release command: add lint:fix step after changeset version

## 0.1.0

### Minor Changes

- Initial release — ad delivery core, web plugins (banner, native, viewability, click), and GPT integration
