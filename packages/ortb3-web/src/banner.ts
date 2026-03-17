import type { DeliveryPlugin } from "@adelv/ortb3";

/**
 * Banner display ad renderer. Creates a sandboxed iframe with `ad.display.adm` markup.
 *
 * Transitions: `pending` → `rendering` → `rendered` (on iframe load) or `error`.
 * Skips if `ad.display` is not present (not a display ad).
 *
 * @returns A `DeliveryPlugin<HTMLElement>` for display ad rendering.
 */
export function banner(): DeliveryPlugin<HTMLElement> {
	return {
		name: "banner",
		setup(delivery, signal) {
			delivery.on("statechange", ({ to }) => {
				if (to !== "pending") return;

				const display = delivery.input?.ad.display;
				if (!display) return;

				delivery.setState("rendering");

				if (!display.adm) {
					delivery.setState("error");
					return;
				}

				const iframe = document.createElement("iframe");
				iframe.srcdoc = display.adm;
				iframe.sandbox.add(
					"allow-scripts",
					"allow-popups",
					"allow-popups-to-escape-sandbox",
				);
				iframe.style.border = "none";
				if (display.w != null) iframe.width = String(display.w);
				if (display.h != null) iframe.height = String(display.h);

				iframe.onload = () => {
					if (signal.aborted) return;
					delivery.setState("rendered");
				};

				iframe.onerror = () => {
					if (signal.aborted) return;
					delivery.emit("error", {
						ts: Date.now(),
						message: "iframe load failed",
						source: "banner",
					});
					delivery.setState("error");
				};

				delivery.target.appendChild(iframe);
			});

			return () => {
				delivery.target.innerHTML = "";
			};
		},
	};
}
