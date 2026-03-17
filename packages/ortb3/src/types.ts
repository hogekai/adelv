import type { Ad } from "iab-adcom/media";

/**
 * Delivery states.
 *
 * ```
 * idle → pending → rendering → rendered → destroyed
 *                             → error    → destroyed
 * ```
 */
export type DeliveryState =
	| "idle"
	| "pending"
	| "rendering"
	| "rendered"
	| "error"
	| "destroyed";

/** State machine transition whitelist. */
export const TRANSITIONS: Record<DeliveryState, readonly DeliveryState[]> = {
	idle: ["pending", "destroyed"],
	pending: ["rendering", "error", "destroyed"],
	rendering: ["rendered", "error", "destroyed"],
	rendered: ["destroyed"],
	error: ["destroyed"],
	destroyed: [],
};

/**
 * Input for ad delivery. Passed to `Delivery.deliver()`.
 *
 * `ad` is the AdCOM Ad object containing creative and event trackers.
 * `purl` and `burl` are Transaction Layer notification URLs.
 */
export interface DeliveryInput {
	/** AdCOM Ad object. */
	ad: Ad;
	/** Pending notification URL (from Transaction Layer). */
	purl?: string;
	/** Billing notification URL (from Transaction Layer). Fired on `rendered` transition. */
	burl?: string;
}

/**
 * Options for `createDelivery()`.
 */
export interface DeliveryOptions {
	/** Timeout in ms for automatic `rendering` → `error` transition. Default: `5000`. */
	renderingTimeout?: number;
	/** Debug logger. Default: `console.warn`. */
	logger?: {
		warn(message: string): void;
	};
	/** Beacon sender function. Default: fetch GET with `keepalive: true`. */
	sendBeacon?: (url: string) => Promise<void>;
}

/**
 * Event map for delivery lifecycle events.
 *
 * - `statechange` — Fired on every state transition.
 * - `impression` — Fired once when entering `rendered`.
 * - `viewable` — Fired by plugins. Core deduplicates (fires trackers once).
 * - `click` — Fired by plugins. Every emission fires click trackers.
 * - `error` — Rendering errors, tracking failures, timeouts.
 * - `destroy` — Fired when delivery is destroyed.
 */
export interface DeliveryEventMap {
	statechange: { from: DeliveryState; to: DeliveryState };
	impression: { ts: number };
	viewable: { ts: number };
	click: { ts: number; url: string };
	error: { ts: number; message: string; source: string };
	destroy: undefined;
}

/**
 * Public API for a delivery instance. One per ad slot.
 *
 * @typeParam T - The delivery target type (e.g., `HTMLElement`).
 */
export interface Delivery<T> {
	readonly target: T;
	readonly state: DeliveryState;
	readonly input: DeliveryInput | null;

	use(plugin: DeliveryPlugin<T>): void;
	deliver(input: DeliveryInput): void;

	on<K extends keyof DeliveryEventMap>(
		event: K,
		handler: (data: DeliveryEventMap[K]) => void,
	): void;
	off<K extends keyof DeliveryEventMap>(
		event: K,
		handler: (data: DeliveryEventMap[K]) => void,
	): void;

	destroy(): void;
}

/**
 * Extended API available to plugins inside `setup()`.
 * Exposes `setState` and `emit` for driving the delivery lifecycle.
 *
 * Does not expose `deliver()` or `use()` — those are public-only.
 *
 * @typeParam T - The delivery target type.
 */
export interface PluginDelivery<T> {
	readonly target: T;
	readonly state: DeliveryState;
	readonly input: DeliveryInput | null;

	setState(state: DeliveryState): void;
	emit<K extends keyof DeliveryEventMap>(
		event: K,
		data: DeliveryEventMap[K],
	): void;

	on<K extends keyof DeliveryEventMap>(
		event: K,
		handler: (data: DeliveryEventMap[K]) => void,
	): void;
	off<K extends keyof DeliveryEventMap>(
		event: K,
		handler: (data: DeliveryEventMap[K]) => void,
	): void;

	destroy(): void;
}

/**
 * Plugin interface. Plugins are trusted code with full lifecycle access.
 *
 * @typeParam T - The delivery target type the plugin operates on.
 *   A `DeliveryPlugin<HTMLElement>` cannot be used with `Delivery<Manifest>`.
 */
export interface DeliveryPlugin<T> {
	name: string;
	setup(
		delivery: PluginDelivery<T>,
		signal: AbortSignal,
	): (() => void) | undefined;
}
