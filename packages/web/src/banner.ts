import type { DeliveryPlugin, PluginDelivery } from "@adelv/adelv";
import type { Display } from "iab-adcom/media";

/**
 * Options for the `banner()` plugin.
 */
export interface BannerOptions {
	/**
	 * iframe sandbox attribute tokens.
	 * Default: `["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"]`
	 *
	 * Set to `null` to remove the sandbox attribute entirely (not recommended).
	 * Only applies to the iframe (markup) rendering path.
	 *
	 * @example
	 * ```typescript
	 * // postMessage-based creatives
	 * banner({ sandbox: ["allow-scripts", "allow-same-origin", "allow-popups"] })
	 * ```
	 */
	sandbox?: string[] | null;

	/**
	 * Additional attributes to set on the rendered element (iframe or img).
	 * Applied via `element.setAttribute(key, value)`.
	 *
	 * @example
	 * ```typescript
	 * banner({ attrs: { loading: "lazy", referrerpolicy: "no-referrer" } })
	 * ```
	 */
	attrs?: Record<string, string>;

	/**
	 * CSS styles to apply to the rendered element (iframe or img).
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
 * Banner display ad renderer. Supports two AdCOM display creative shapes:
 *
 * - **Markup** (`ad.display.adm`) — rendered in a sandboxed iframe.
 * - **Structured image** (`ad.display.banner.img`) — rendered as an `<img>`,
 *   wrapped in an `<a>` when `ad.display.banner.link.url` is present.
 *
 * Transitions: `pending` → `rendering` → `rendered` (on load) or `error`.
 * Skips if `ad.display` is not present. Errors if neither `adm` nor
 * `banner.img` is available.
 *
 * @param opts - Configuration for sandbox, style, and attributes.
 * @returns A `DeliveryPlugin<HTMLElement>` for display ad rendering.
 */
export function banner(opts?: BannerOptions): DeliveryPlugin<HTMLElement> {
	const sandboxTokens =
		opts?.sandbox !== undefined
			? opts.sandbox
			: ["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"];

	function applyStyle(el: HTMLElement): void {
		el.style.border = "none";
		if (opts?.style) {
			for (const [key, value] of Object.entries(opts.style)) {
				if (typeof value === "string") {
					el.style.setProperty(
						key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
						value,
					);
				}
			}
		}
	}

	function applyAttrs(el: HTMLElement): void {
		if (opts?.attrs) {
			for (const [key, value] of Object.entries(opts.attrs)) {
				el.setAttribute(key, value);
			}
		}
	}

	function renderMarkup(
		delivery: PluginDelivery<HTMLElement>,
		signal: AbortSignal,
		display: Display,
		adm: string,
	): void {
		const iframe = document.createElement("iframe");
		iframe.srcdoc = adm;

		if (sandboxTokens !== null) {
			for (const token of sandboxTokens) {
				iframe.sandbox.add(token);
			}
		}

		applyStyle(iframe);

		if (display.w != null) iframe.width = String(display.w);
		if (display.h != null) iframe.height = String(display.h);

		applyAttrs(iframe);

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
	}

	function renderImage(
		delivery: PluginDelivery<HTMLElement>,
		signal: AbortSignal,
		display: Display,
		src: string,
	): void {
		const img = document.createElement("img");
		img.src = src;

		applyStyle(img);

		if (display.w != null) img.width = display.w;
		if (display.h != null) img.height = display.h;

		applyAttrs(img);

		img.onload = () => {
			if (signal.aborted) return;
			delivery.setState("rendered");
		};

		img.onerror = () => {
			if (signal.aborted) return;
			delivery.emit("error", {
				ts: Date.now(),
				message: "image load failed",
				source: "banner",
			});
			delivery.setState("error");
		};

		const link = display.banner?.link?.url;
		if (link) {
			const anchor = document.createElement("a");
			anchor.href = link;
			anchor.appendChild(img);
			delivery.target.appendChild(anchor);
		} else {
			delivery.target.appendChild(img);
		}
	}

	return {
		name: "banner",
		setup(delivery, signal) {
			delivery.on("statechange", ({ to }) => {
				if (to !== "pending") return;

				const display = delivery.input?.ad.display;
				if (!display) return;

				delivery.setState("rendering");

				if (display.adm) {
					renderMarkup(delivery, signal, display, display.adm);
				} else if (display.banner?.img) {
					renderImage(delivery, signal, display, display.banner.img);
				} else {
					delivery.setState("error");
				}
			});

			return () => {
				delivery.target.innerHTML = "";
			};
		},
	};
}
