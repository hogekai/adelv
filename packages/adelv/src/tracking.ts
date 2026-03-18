import { EventTrackingMethod, type EventType } from "iab-adcom/enum";
import type { Ad, Event } from "iab-adcom/media";

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

/** Filter ad.display.event by EventType and return IMAGE_PIXEL URLs. */
export function getEventUrls(ad: Ad, type: EventType): string[] {
	const events = ad.display?.event;
	if (!events) return [];
	return events
		.filter(
			(e): e is Event & { url: string } =>
				e.type === type &&
				e.method === EventTrackingMethod.IMAGE_PIXEL &&
				typeof e.url === "string",
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
