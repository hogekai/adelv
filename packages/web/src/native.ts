import type { DeliveryPlugin } from "@adelv/adelv";
import type { Ad } from "iab-adcom/media";

/**
 * Options for the `native()` plugin.
 */
export interface NativeOptions {
	/**
	 * Render function. Receives the target element and the AdCOM Ad object.
	 * Build the native ad DOM inside `target`.
	 *
	 * Optionally return a cleanup function (sync). Called on destroy.
	 * If no cleanup is returned, `target.innerHTML = ""` is used as default.
	 *
	 * @param target - The HTMLElement to render into.
	 * @param ad - The AdCOM Ad object. Access `ad.display.native.asset` for structured assets.
	 */
	render: (target: HTMLElement, ad: Ad) => (() => void) | undefined;
}

/**
 * Native ad renderer. Delegates DOM construction to a user-provided render function.
 *
 * Transitions: `pending` → `rendering` → `rendered` or `error`.
 * Skips if `ad.display?.native` is not present (not a native ad).
 *
 * @param opts.render - Function that builds the native ad DOM. Optionally returns cleanup.
 * @returns A `DeliveryPlugin<HTMLElement>` for native ad rendering.
 */
export function native(opts: NativeOptions): DeliveryPlugin<HTMLElement> {
	return {
		name: "native",
		setup(delivery, signal) {
			let renderCleanup: (() => void) | null = null;

			delivery.on("statechange", ({ to }) => {
				if (to !== "pending") return;

				const input = delivery.input;
				if (!input?.ad.display?.native) return;

				delivery.setState("rendering");

				if (signal.aborted) return;

				try {
					const result = opts.render(delivery.target, input.ad);
					if (signal.aborted) return;

					if (typeof result === "function") {
						renderCleanup = result;
					}

					delivery.setState("rendered");
				} catch (e) {
					if (signal.aborted) return;
					const message = e instanceof Error ? e.message : String(e);
					delivery.emit("error", {
						ts: Date.now(),
						message: `Native render failed: ${message}`,
						source: "native",
					});
					delivery.setState("error");
				}
			});

			return () => {
				if (renderCleanup) {
					renderCleanup();
					renderCleanup = null;
				} else {
					delivery.target.innerHTML = "";
				}
			};
		},
	};
}
