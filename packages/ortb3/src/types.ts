import type { Ad } from "iab-adcom/media";

// --- State ---

export type DeliveryState =
	| "idle"
	| "pending"
	| "rendering"
	| "rendered"
	| "error"
	| "destroyed";

// --- Transitions whitelist ---

export const TRANSITIONS: Record<DeliveryState, readonly DeliveryState[]> = {
	idle: ["pending", "destroyed"],
	pending: ["rendering", "error", "destroyed"],
	rendering: ["rendered", "error", "destroyed"],
	rendered: ["destroyed"],
	error: ["destroyed"],
	destroyed: [],
};

// --- Input ---

export interface DeliveryInput {
	/** AdCOM Ad object */
	ad: Ad;
	/** Pending notification URL（Transaction Layerから） */
	purl?: string;
	/** Billing notification URL（Transaction Layerから。rendered遷移で発火） */
	burl?: string;
}

// --- Options ---

export interface DeliveryOptions {
	/** rendering → error の自動遷移タイムアウト（ms）。デフォルト 5000 */
	renderingTimeout?: number;
	/** デバッグ用logger。デフォルトはconsole.warn */
	logger?: {
		warn(message: string): void;
	};
	/** beacon発火関数。デフォルトは fetch GET */
	sendBeacon?: (url: string) => Promise<void>;
}

// --- Events ---

export interface DeliveryEventMap {
	statechange: { from: DeliveryState; to: DeliveryState };
	impression: { ts: number };
	viewable: { ts: number };
	click: { ts: number; url: string };
	error: { ts: number; message: string; source: string };
	destroy: undefined;
}

// --- Delivery (public API) ---

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

// --- PluginDelivery (plugin-only API) ---

export interface PluginDelivery<T> extends Delivery<T> {
	setState(state: DeliveryState): void;
	emit<K extends keyof DeliveryEventMap>(
		event: K,
		data: DeliveryEventMap[K],
	): void;
}

// --- Plugin ---

export interface DeliveryPlugin<T> {
	name: string;
	setup(
		delivery: PluginDelivery<T>,
		signal: AbortSignal,
	): (() => void) | undefined;
}
