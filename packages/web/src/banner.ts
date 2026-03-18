import type { DeliveryPlugin } from "@adelv/adelv";

/**
 * Options for the `banner()` plugin.
 */
export interface BannerOptions {
	/**
	 * iframe sandbox attribute tokens.
	 * Default: `["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"]`
	 *
	 * Set to `null` to remove the sandbox attribute entirely (not recommended).
	 *
	 * @example
	 * ```typescript
	 * // postMessage-based creatives
	 * banner({ sandbox: ["allow-scripts", "allow-same-origin", "allow-popups"] })
	 * ```
	 */
	sandbox?: string[] | null;

	/**
	 * Additional attributes to set on the iframe element.
	 * Applied via `iframe.setAttribute(key, value)`.
	 *
	 * @example
	 * ```typescript
	 * banner({ attrs: { loading: "lazy", referrerpolicy: "no-referrer" } })
	 * ```
	 */
	attrs?: Record<string, string>;

	/**
	 * CSS styles to apply to the iframe element.
	 * Merged with defaults. Explicit values override defaults.
	 *
	 * Defaults: `{ border: "none" }`
	 *
	 * @example
	 * ```typescript
	 * banner({ style: { width: "100%", height: "auto" } })
	 * ```
	 */
	style?: Partial<CSSStyleDeclaration>;
}

/**
 * Banner display ad renderer. Creates a sandboxed iframe with `ad.display.adm` markup.
 *
 * Transitions: `pending` → `rendering` → `rendered` (on iframe load) or `error`.
 * Skips if `ad.display` is not present (not a display ad).
 *
 * @param opts - Configuration for sandbox, style, and attributes.
 * @returns A `DeliveryPlugin<HTMLElement>` for display ad rendering.
 */
export function banner(opts?: BannerOptions): DeliveryPlugin<HTMLElement> {
	const sandboxTokens =
		opts?.sandbox !== undefined
			? opts.sandbox
			: ["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"];

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

				// sandbox
				if (sandboxTokens !== null) {
					for (const token of sandboxTokens) {
						iframe.sandbox.add(token);
					}
				}

				// style: defaults + overrides
				iframe.style.border = "none";
				if (opts?.style) {
					for (const [key, value] of Object.entries(opts.style)) {
						if (typeof value === "string") {
							iframe.style.setProperty(
								key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
								value,
							);
						}
					}
				}

				// width/height from ad
				if (display.w != null) iframe.width = String(display.w);
				if (display.h != null) iframe.height = String(display.h);

				// additional attributes
				if (opts?.attrs) {
					for (const [key, value] of Object.entries(opts.attrs)) {
						iframe.setAttribute(key, value);
					}
				}

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
