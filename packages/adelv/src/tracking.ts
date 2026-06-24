import { EventTrackingMethod, EventType } from "iab-adcom/enum";
import type { Ad, Event } from "iab-adcom/media";
import type { ViewableStandard } from "./types.js";

/** Map a viewability standard to its AdCOM `EventType`. */
const VIEWABLE_EVENT_TYPE: Record<ViewableStandard, EventType> = {
	mrc50: EventType.VIEWABLE_MRC_50,
	mrc100: EventType.VIEWABLE_MRC_100,
	video50: EventType.VIEWABLE_VIDEO_50,
};

/** Resolve the AdCOM `EventType` fired for a given viewability standard. */
export function viewableEventType(standard: ViewableStandard): EventType {
	return VIEWABLE_EVENT_TYPE[standard];
}

/**
 * Function signature for sending tracking beacons.
 * Implement this to customize how beacon URLs are fired.
 *
 * @example
 * ```typescript
 * const sendBeacon: BeaconSender = async (url) => {
 *   navigator.sendBeacon(url)
 * }
 * ```
 */
export type BeaconSender = (url: string) => Promise<void>;

/** Default beacon sender. Fires a GET request via `fetch` with `keepalive: true`. */
export const defaultSendBeacon: BeaconSender = async (url: string) => {
	await fetch(url, { method: "GET", keepalive: true });
};

/**
 * Filter `ad.display.event` by `EventType` and tracking `method`, returning URLs.
 *
 * @param method - Tracking method to extract. Defaults to `IMAGE_PIXEL` (core
 *   fires these as beacons). Pass `JAVASCRIPT` from web plugins that inject script tags.
 */
export function getEventUrls(
	ad: Ad,
	type: EventType,
	method: EventTrackingMethod = EventTrackingMethod.IMAGE_PIXEL,
): string[] {
	const events = ad.display?.event;
	if (!events) return [];
	return events
		.filter(
			(e): e is Event & { url: string } =>
				e.type === type && e.method === method && typeof e.url === "string",
		)
		.map((e) => e.url);
}

/** Collect click tracker URLs from LinkAsset.trkr[] in banner and native assets. */
export function getClickTrackerUrls(ad: Ad): string[] {
	const urls: string[] = [];
	if (ad.display?.banner?.link?.trkr) {
		urls.push(...ad.display.banner.link.trkr);
	}
	if (ad.display?.native?.link?.trkr) {
		urls.push(...ad.display.native.link.trkr);
	}
	if (ad.display?.native?.asset) {
		for (const asset of ad.display.native.asset) {
			if (asset.link?.trkr) {
				urls.push(...asset.link.trkr);
			}
		}
	}
	return urls;
}

/** Fire all beacon URLs. Failures are reported via onError callback. Fire-and-forget. */
export function fireBeacons(
	urls: string[],
	sendBeacon: BeaconSender,
	onError: (url: string, error: unknown) => void,
): void {
	for (const url of urls) {
		sendBeacon(url).catch((error) => onError(url, error));
	}
}
