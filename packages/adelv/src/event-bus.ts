import type { DeliveryEventMap } from "./types.js";

export interface EventBus {
	on<K extends keyof DeliveryEventMap>(
		event: K,
		handler: (data: DeliveryEventMap[K]) => void,
	): void;

	off<K extends keyof DeliveryEventMap>(
		event: K,
		handler: (data: DeliveryEventMap[K]) => void,
	): void;

	emit<K extends keyof DeliveryEventMap>(
		event: K,
		data: DeliveryEventMap[K],
	): void;
}

export function createEventBus(): EventBus {
	const listeners = new Map<
		keyof DeliveryEventMap,
		((data: never) => void)[]
	>();
	let viewableFired = false;

	return {
		on(event, handler) {
			let handlers = listeners.get(event);
			if (!handlers) {
				handlers = [];
				listeners.set(event, handlers);
			}
			handlers.push(handler as (data: never) => void);
		},

		off(event, handler) {
			const handlers = listeners.get(event);
			if (!handlers) return;
			const idx = handlers.indexOf(handler as (data: never) => void);
			if (idx !== -1) {
				handlers.splice(idx, 1);
			}
		},

		emit(event, data) {
			if (event === "viewable") {
				if (viewableFired) return;
				viewableFired = true;
			}

			const handlers = listeners.get(event);
			if (!handlers) return;
			for (const handler of [...handlers]) {
				handler(data as never);
			}
		},
	};
}
