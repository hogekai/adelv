declare namespace googletag {
	const cmd: Array<() => void>;
	function defineSlot(
		adUnit: string,
		sizes: number[][],
		elementId: string,
	): Slot | null;
	function enableServices(): void;
	function destroySlots(slots: Slot[]): void;

	interface Slot {
		setTargeting(key: string, value: string | string[]): Slot;
	}

	function pubads(): PubAdsService;

	interface PubAdsService {
		disableInitialLoad(): void;
		refresh(slots: Slot[]): void;
		addEventListener(
			event: "slotRenderEnded",
			fn: (e: events.SlotRenderEndedEvent) => void,
		): void;
		removeEventListener(
			event: "slotRenderEnded",
			fn: (e: events.SlotRenderEndedEvent) => void,
		): void;
	}

	namespace events {
		interface SlotRenderEndedEvent {
			slot: Slot;
		}
	}
}
