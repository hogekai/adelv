import type { DeliveryPlugin } from "@adelv/adelv";
import type { Ad } from "iab-adcom/media";
import { delegatedRenderer } from "./delegated-renderer.js";

/**
 * Options for the `video()` plugin.
 */
export interface VideoOptions {
	/**
	 * Render function. Receives the target element and the AdCOM Ad object.
	 * Delegate the VAST markup in `ad.video.adm` to an external video player.
	 *
	 * Optionally return a cleanup function (sync). Called on destroy.
	 * If no cleanup is returned, `target.innerHTML = ""` is used as default.
	 *
	 * @param target - The HTMLElement to render into.
	 * @param ad - The AdCOM Ad object. Access `ad.video.adm` for the VAST markup.
	 */
	render: (target: HTMLElement, ad: Ad) => (() => void) | undefined;
}

/**
 * Video ad renderer. Delegates playback to a user-provided render function
 * (e.g. a VAST player), since video tracking lives inside the VAST document.
 *
 * Transitions: `pending` → `rendering` → `rendered` or `error`.
 * Skips if `ad.video` is not present (not a video ad).
 *
 * @param opts.render - Function that mounts the video player. Optionally returns cleanup.
 * @returns A `DeliveryPlugin<HTMLElement>` for video ad rendering.
 */
export function video(opts: VideoOptions): DeliveryPlugin<HTMLElement> {
	return delegatedRenderer("video", (ad) => ad.video != null, opts.render);
}
