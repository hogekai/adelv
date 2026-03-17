import { EventType } from "iab-adcom/enum";
import { createEventBus } from "./event-bus.js";
import { isValidTransition } from "./state-machine.js";
import {
	defaultSendBeacon,
	fireBeacons,
	getClickTrackerUrls,
	getEventUrls,
} from "./tracking.js";
import type {
	Delivery,
	DeliveryEventMap,
	DeliveryInput,
	DeliveryOptions,
	DeliveryPlugin,
	DeliveryState,
	PluginDelivery,
} from "./types.js";

export function createDelivery<T>(
	target: T,
	options?: DeliveryOptions,
): Delivery<T> {
	const logger = options?.logger ?? { warn: console.warn };
	const renderingTimeout = options?.renderingTimeout ?? 5000;
	const sendBeacon = options?.sendBeacon ?? defaultSendBeacon;

	let state: DeliveryState = "idle";
	let input: DeliveryInput | null = null;
	const abortController = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	const bus = createEventBus();
	const cleanups: Array<() => void> = [];

	bus.on("viewable", () => {
		if (!input) return;
		const urls = getEventUrls(input.ad, EventType.VIEWABLE_MRC_50);
		fireBeacons(urls, sendBeacon, trackingError);
	});

	bus.on("click", () => {
		if (!input) return;
		const urls = getClickTrackerUrls(input.ad);
		fireBeacons(urls, sendBeacon, trackingError);
	});

	function trackingError(url: string, error: unknown): void {
		const detail = error instanceof Error ? error.message : String(error);
		bus.emit("error", {
			ts: Date.now(),
			message: `Beacon failed: ${url} (${detail})`,
			source: "tracking",
		});
	}

	function clearRenderingTimeout(): void {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	}

	function setState(newState: DeliveryState): void {
		if (newState === state) return;
		if (!isValidTransition(state, newState)) {
			logger.warn(`Invalid transition: ${state} → ${newState}`);
			return;
		}

		const from = state;
		state = newState;

		if (newState === "rendering") {
			timeoutId = setTimeout(() => {
				timeoutId = null;
				abortController.abort();
				setState("error");
				bus.emit("error", {
					ts: Date.now(),
					message: "Rendering timeout",
					source: "timeout",
				});
			}, renderingTimeout);
		}

		if (newState === "rendered" || newState === "error") {
			clearRenderingTimeout();
		}

		bus.emit("statechange", { from, to: newState });

		if (newState === "pending" && input?.purl) {
			fireBeacons([input.purl], sendBeacon, trackingError);
		}

		if (newState === "rendered") {
			bus.emit("impression", { ts: Date.now() });

			if (input) {
				const urls: string[] = [];
				if (input.burl) urls.push(input.burl);
				urls.push(...getEventUrls(input.ad, EventType.IMPRESSION));
				fireBeacons(urls, sendBeacon, trackingError);
			}
		}

		if (newState === "destroyed") {
			bus.emit("destroy", undefined);
			for (const cleanup of cleanups) {
				cleanup();
			}
			clearRenderingTimeout();
			abortController.abort();
		}
	}

	function pluginEmit<K extends keyof DeliveryEventMap>(
		event: K,
		data: DeliveryEventMap[K],
	): void {
		if (state === "destroyed") return;
		bus.emit(event, data);
	}

	function use(plugin: DeliveryPlugin<T>): void {
		const pluginDelivery: PluginDelivery<T> = {
			get target() {
				return target;
			},
			get state() {
				return state;
			},
			get input() {
				return input;
			},
			use,
			deliver,
			on: bus.on,
			off: bus.off,
			destroy,
			setState,
			emit: pluginEmit,
		};
		const cleanup = plugin.setup(pluginDelivery, abortController.signal);
		if (cleanup) {
			cleanups.push(cleanup);
		}
	}

	function deliver(deliveryInput: DeliveryInput): void {
		if (state !== "idle") {
			throw new Error(`deliver() called in "${state}" state. Expected "idle".`);
		}
		input = deliveryInput;
		setState("pending");
	}

	function destroy(): void {
		setState("destroyed");
	}

	return {
		get target() {
			return target;
		},
		get state() {
			return state;
		},
		get input() {
			return input;
		},
		use,
		deliver,
		on: bus.on,
		off: bus.off,
		destroy,
	};
}
