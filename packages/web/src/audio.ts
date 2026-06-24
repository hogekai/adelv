import type { DeliveryPlugin } from "@adelv/adelv";
import type { Ad } from "iab-adcom/media";
import { delegatedRenderer } from "./delegated-renderer.js";

/**
 * Options for the `audio()` plugin.
 */
export interface AudioOptions {
	/**
	 * Render function. Receives the target element and the AdCOM Ad object.
	 * Delegate the DAAST markup in `ad.audio.adm` to an external audio player.
	 *
	 * Optionally return a cleanup function (sync). Called on destroy.
	 * If no cleanup is returned, `target.innerHTML = ""` is used as default.
	 *
	 * @param target - The HTMLElement to render into.
	 * @param ad - The AdCOM Ad object. Access `ad.audio.adm` for the DAAST markup.
	 */
	render: (target: HTMLElement, ad: Ad) => (() => void) | undefined;
}

/**
 * Audio ad renderer. Delegates playback to a user-provided render function
 * (e.g. a DAAST player), since audio tracking lives inside the DAAST document.
 *
 * Transitions: `pending` → `rendering` → `rendered` or `error`.
 * Skips if `ad.audio` is not present (not an audio ad).
 *
 * @param opts.render - Function that mounts the audio player. Optionally returns cleanup.
 * @returns A `DeliveryPlugin<HTMLElement>` for audio ad rendering.
 */
export function audio(opts: AudioOptions): DeliveryPlugin<HTMLElement> {
	return delegatedRenderer("audio", (ad) => ad.audio != null, opts.render);
}
