import type { DeliveryPlugin } from "@adelv/adelv";
import type { Ad } from "iab-adcom/media";

/** Render function: build the ad DOM in `target`; optionally return sync cleanup. */
export type RenderFn = (
	target: HTMLElement,
	ad: Ad,
) => (() => void) | undefined;

/**
 * Build a rendering plugin that delegates DOM construction to a user `render`
 * function, driving the standard `pending → rendering → rendered/error` lifecycle.
 *
 * Shared by `native`, `video`, and `audio` — they differ only in which part of
 * the AdCOM Ad makes them applicable.
 *
 * @param name - Plugin name and `error` event source.
 * @param isApplicable - Returns true when this plugin should render the ad.
 * @param render - Builds the ad DOM. Optionally returns a sync cleanup function.
 */
export function delegatedRenderer(
	name: string,
	isApplicable: (ad: Ad) => boolean,
	render: RenderFn,
): DeliveryPlugin<HTMLElement> {
	return {
		name,
		setup(delivery, signal) {
			let renderCleanup: (() => void) | null = null;

			delivery.on("statechange", ({ to }) => {
				if (to !== "pending") return;

				const input = delivery.input;
				if (!input || !isApplicable(input.ad)) return;

				delivery.setState("rendering");

				if (signal.aborted) return;

				try {
					const result = render(delivery.target, input.ad);
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
						message: `${name} render failed: ${message}`,
						source: name,
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
