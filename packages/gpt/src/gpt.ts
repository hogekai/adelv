import type { DeliveryPlugin } from "@adelv/adelv";
import type { Bid } from "iab-openrtb/v30";

/**
 * Build GAM targeting key-values from OpenRTB 3.0 bids.
 *
 * Generated keys:
 * - `hb_pb` — Price bucket (CPM floored to 2 decimal places)
 * - `hb_deal` — Deal ID (if present)
 * - `hb_size` — Creative size as `WxH` (if ad has display dimensions)
 *
 * @param bids - Array of OpenRTB 3.0 bids. Targeting is derived from the highest-priced bid.
 * @returns Key-value pairs for GAM slot targeting.
 */
export function buildTargeting(bids: Bid[]): Record<string, string> {
	const result: Record<string, string> = {};
	if (bids.length === 0) return result;

	const topBid = bids.reduce((a, b) => (a.price > b.price ? a : b));

	result.hb_pb = String(Math.floor(topBid.price * 100) / 100);

	if (topBid.deal) result.hb_deal = topBid.deal;

	const display = topBid.media?.display;
	if (display?.w != null && display?.h != null) {
		result.hb_size = `${display.w}x${display.h}`;
	}

	return result;
}

let servicesEnabled = false;

/**
 * Google Publisher Tag integration plugin.
 *
 * Defines a GPT slot, sets header bidding targeting from bid data,
 * and renders via `googletag.pubads().refresh()`.
 *
 * `enableServices()` is called once globally across all GPT plugin instances.
 *
 * @param opts.adUnit - GAM ad unit path (e.g., "/12345/header").
 * @param opts.sizes - Array of ad sizes (e.g., `[[728, 90], [970, 250]]`).
 * @param opts.bids - Optional OpenRTB 3.0 bids for targeting. Sets `hb_pb`, `hb_deal`, `hb_size`.
 * @param opts.targeting - Optional direct key-values. Merged after auto-generated targeting (overrides on conflict).
 * @returns A `DeliveryPlugin<HTMLElement>` for GPT rendering.
 */
export function gpt(opts: {
	adUnit: string;
	sizes: [number, number][];
	bids?: Bid[];
	/** Direct targeting key-values. Merged after auto-generated targeting from bids. */
	targeting?: Record<string, string | string[]>;
}): DeliveryPlugin<HTMLElement> {
	return {
		name: "gpt",
		setup(delivery, signal) {
			let slot: googletag.Slot | null = null;
			let listener:
				| ((e: googletag.events.SlotRenderEndedEvent) => void)
				| null = null;

			delivery.on("statechange", ({ to }) => {
				if (to !== "pending") return;

				delivery.setState("rendering");

				googletag.cmd.push(() => {
					if (signal.aborted) return;

					const defined = googletag.defineSlot(
						opts.adUnit,
						opts.sizes,
						delivery.target.id,
					);
					if (!defined) return;
					slot = defined;

					googletag.pubads().disableInitialLoad();
					if (!servicesEnabled) {
						googletag.enableServices();
						servicesEnabled = true;
					}

					const autoKv = opts.bids ? buildTargeting(opts.bids) : {};
					const mergedKv: Record<string, string | string[]> = {
						...autoKv,
					};
					if (opts.targeting) {
						for (const [key, value] of Object.entries(opts.targeting)) {
							mergedKv[key] = value;
						}
					}

					for (const [key, value] of Object.entries(mergedKv)) {
						slot.setTargeting(
							key,
							Array.isArray(value) ? value : [value],
						);
					}

					listener = (e) => {
						if (e.slot === slot) {
							if (signal.aborted) return;
							delivery.setState("rendered");
						}
					};
					googletag.pubads().addEventListener("slotRenderEnded", listener);

					googletag.pubads().refresh([slot]);
				});
			});

			return () => {
				if (listener) {
					googletag.pubads().removeEventListener("slotRenderEnded", listener);
					listener = null;
				}
				if (slot) {
					googletag.destroySlots([slot]);
					slot = null;
				}
			};
		},
	};
}
