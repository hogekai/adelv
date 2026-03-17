import { EventTrackingMethod, type EventType } from "iab-adcom/enum";
import type { Ad, Event } from "iab-adcom/media";

export type BeaconSender = (url: string) => Promise<void>;

export const defaultSendBeacon: BeaconSender = async (url: string) => {
	await fetch(url, { method: "GET", keepalive: true });
};

/**
 * ad.display?.event からEventTypeでフィルタし、IMAGE_PIXELのURLだけ返す
 */
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

/**
 * Ad内のLinkAsset.trkr[]からクリックトラッカーURLを収集する
 */
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

/**
 * URLリストを全て発火。失敗したらonErrorコールバック。
 * fire-and-forget。awaitしてステート遷移をブロックしない。
 */
export function fireBeacons(
	urls: string[],
	sendBeacon: BeaconSender,
	onError: (url: string, error: unknown) => void,
): void {
	for (const url of urls) {
		sendBeacon(url).catch((error) => onError(url, error));
	}
}
