import type { DeliveryPlugin } from "@adelv/adelv";
import type { Ad } from "iab-adcom/media";

function getLandingUrl(ad: Ad): string | undefined {
	if (ad.display?.banner?.link?.url) return ad.display.banner.link.url;
	if (ad.display?.native?.link?.url) return ad.display.native.link.url;
	return undefined;
}

/**
 * Click detection plugin. Detects clicks on the target element and iframe focus events.
 *
 * - Direct clicks: `click` event listener on the target element (for native ads).
 * - Iframe clicks: `window.blur` + `document.activeElement` heuristic (best effort).
 *
 * Landing URL is extracted from `ad.display.banner.link.url` or `ad.display.native.link.url`.
 * Starts detecting after `rendered`.
 *
 * @returns A `DeliveryPlugin<HTMLElement>` for click detection.
 */
export function click(): DeliveryPlugin<HTMLElement> {
	return {
		name: "click",
		setup(delivery, signal) {
			let onClick: ((e: MouseEvent) => void) | null = null;
			let onBlur: (() => void) | null = null;
			let resetOnFocus: (() => void) | null = null;

			delivery.on("statechange", ({ to }) => {
				if (to !== "rendered") return;

				onClick = () => {
					if (signal.aborted) return;
					const ad = delivery.input?.ad;
					if (!ad) return;
					const url = getLandingUrl(ad);
					if (!url) return;
					delivery.emit("click", { ts: Date.now(), url });
				};
				delivery.target.addEventListener("click", onClick);

				let iframeFocusDetected = false;

				onBlur = () => {
					if (signal.aborted) return;
					const active = document.activeElement;
					if (
						active instanceof HTMLIFrameElement &&
						delivery.target.contains(active)
					) {
						if (iframeFocusDetected) return;
						iframeFocusDetected = true;
						const ad = delivery.input?.ad;
						if (!ad) return;
						const url = getLandingUrl(ad);
						if (!url) return;
						delivery.emit("click", { ts: Date.now(), url });

						const onFocus = () => {
							iframeFocusDetected = false;
							window.removeEventListener("focus", onFocus);
							resetOnFocus = null;
						};
						resetOnFocus = onFocus;
						window.addEventListener("focus", onFocus);
					}
				};
				window.addEventListener("blur", onBlur);
			});

			return () => {
				if (onClick) delivery.target.removeEventListener("click", onClick);
				if (onBlur) window.removeEventListener("blur", onBlur);
				if (resetOnFocus) window.removeEventListener("focus", resetOnFocus);
			};
		},
	};
}
