import type { DeliveryPlugin } from "@adelv/ortb3";
import type { Bid } from "iab-openrtb/v30";

function buildTargeting(bids: Bid[]): Record<string, string> {
	const result: Record<string, string> = {};
	if (bids.length > 0) {
		const topBid = bids.reduce((a, b) => (a.price > b.price ? a : b));
		result.hb_pb = String(Math.floor(topBid.price * 100) / 100);
		if (topBid.deal) result.hb_deal = topBid.deal;
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
 * @param opts.bids - Optional OpenRTB 3.0 bids for targeting. Sets `hb_pb` and `hb_deal`.
 * @returns A `DeliveryPlugin<HTMLElement>` for GPT rendering.
 */
export function gpt(opts: {
	adUnit: string;
	sizes: [number, number][];
	bids?: Bid[];
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

					if (opts.bids) {
						const targeting = buildTargeting(opts.bids);
						for (const [key, value] of Object.entries(targeting)) {
							slot.setTargeting(key, value);
						}
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
