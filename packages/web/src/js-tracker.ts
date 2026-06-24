import {
	type DeliveryPlugin,
	getEventUrls,
	viewableEventType,
} from "@adelv/adelv";
import { EventTrackingMethod, EventType } from "iab-adcom/enum";

/**
 * Options for the `jsTracker()` plugin.
 */
export interface JsTrackerOptions {
	/**
	 * Where injected `<script>` tags are mounted.
	 * - `"target"` (default) — inside the delivery target element.
	 * - `"head"` — in `document.head`.
	 */
	mount?: "target" | "head";
}

/**
 * JavaScript event tracker plugin.
 *
 * Core fires `IMAGE_PIXEL` trackers as beacons. This plugin handles the
 * web-specific `JAVASCRIPT` tracking method by injecting `<script>` tags for
 * the matching `EventType` at each lifecycle moment:
 *
 * - on `impression` (rendered) — `LOADED` and `IMPRESSION` trackers.
 * - on `viewable` — the tracker for the met viewability standard.
 *
 * Only `EventTrackingMethod.JAVASCRIPT` entries from `ad.display.event` are used.
 *
 * @param opts.mount - Where to inject scripts. Default: `"target"`.
 * @returns A `DeliveryPlugin<HTMLElement>` for JavaScript tracker injection.
 */
export function jsTracker(
	opts?: JsTrackerOptions,
): DeliveryPlugin<HTMLElement> {
	const mount = opts?.mount ?? "target";

	return {
		name: "js-tracker",
		setup(delivery, signal) {
			const injected: HTMLScriptElement[] = [];

			function inject(urls: string[]): void {
				if (signal.aborted) return;
				const parent = mount === "head" ? document.head : delivery.target;
				for (const url of urls) {
					const script = document.createElement("script");
					script.src = url;
					script.async = true;
					parent.appendChild(script);
					injected.push(script);
				}
			}

			delivery.on("impression", () => {
				const ad = delivery.input?.ad;
				if (!ad) return;
				inject([
					...getEventUrls(ad, EventType.LOADED, EventTrackingMethod.JAVASCRIPT),
					...getEventUrls(
						ad,
						EventType.IMPRESSION,
						EventTrackingMethod.JAVASCRIPT,
					),
				]);
			});

			delivery.on("viewable", ({ standard }) => {
				const ad = delivery.input?.ad;
				if (!ad) return;
				inject(
					getEventUrls(
						ad,
						viewableEventType(standard),
						EventTrackingMethod.JAVASCRIPT,
					),
				);
			});

			return () => {
				for (const script of injected) {
					script.remove();
				}
				injected.length = 0;
			};
		},
	};
}
