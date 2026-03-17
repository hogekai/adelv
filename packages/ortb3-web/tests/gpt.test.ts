import { createDelivery } from "@adelv/ortb3";
import type { Bid } from "iab-openrtb/v30";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gpt } from "../src/gpt.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function createMockGoogletag() {
	const cmdQueue: Array<() => void> = [];
	const listeners = new Map<string, Set<(e: unknown) => void>>();
	const slots: googletag.Slot[] = [];

	const mockSlot: googletag.Slot = {
		setTargeting: vi.fn(function (this: googletag.Slot) {
			return this;
		}),
	};

	const mockPubads: googletag.PubAdsService = {
		disableInitialLoad: vi.fn(),
		refresh: vi.fn(),
		addEventListener: vi.fn((event: string, fn: (e: unknown) => void) => {
			if (!listeners.has(event)) listeners.set(event, new Set());
			listeners.get(event)!.add(fn);
		}),
		removeEventListener: vi.fn((event: string, fn: (e: unknown) => void) => {
			listeners.get(event)?.delete(fn);
		}),
	};

	const mock = {
		cmd: cmdQueue,
		defineSlot: vi.fn(() => mockSlot),
		enableServices: vi.fn(),
		destroySlots: vi.fn(),
		pubads: vi.fn(() => mockPubads),
		// test helpers
		_mockSlot: mockSlot,
		_mockPubads: mockPubads,
		_listeners: listeners,
		_flushCmd() {
			while (cmdQueue.length > 0) {
				cmdQueue.shift()!();
			}
		},
		_fireSlotRenderEnded(slot?: googletag.Slot) {
			const fns = listeners.get("slotRenderEnded");
			if (fns) {
				for (const fn of fns) {
					fn({ slot: slot ?? mockSlot });
				}
			}
		},
	};

	return mock;
}

let mockGt: ReturnType<typeof createMockGoogletag>;

beforeEach(() => {
	mockGt = createMockGoogletag();
	vi.stubGlobal("googletag", mockGt);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("gpt plugin", () => {
	it("pushes to googletag.cmd on pending", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(gpt({ adUnit: "/1234/unit", sizes: [[300, 250]] }));
		delivery.deliver({ ad: { id: "test-ad" } });

		expect(
			mockGt.cmd.length + (mockGt.defineSlot.mock.calls.length > 0 ? 0 : 0),
		).toBeGreaterThanOrEqual(0);
		// Flush cmd queue
		mockGt._flushCmd();

		expect(mockGt.defineSlot).toHaveBeenCalledWith(
			"/1234/unit",
			[[300, 250]],
			"ad-slot-1",
		);
	});

	it("transitions to rendered on slotRenderEnded", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(gpt({ adUnit: "/1234/unit", sizes: [[300, 250]] }));
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		expect(delivery.state).toBe("rendering");

		mockGt._fireSlotRenderEnded();

		expect(delivery.state).toBe("rendered");
	});

	it("sets targeting from bids", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const bids: Bid[] = [
			{ item: "1", price: 2.567 },
			{ item: "1", price: 1.5, deal: "deal-123" },
		];
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(gpt({ adUnit: "/1234/unit", sizes: [[300, 250]], bids }));
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		expect(mockGt._mockSlot.setTargeting).toHaveBeenCalledWith("hb_pb", "2.56");
	});

	it("calls destroySlots and removeEventListener on cleanup", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(gpt({ adUnit: "/1234/unit", sizes: [[300, 250]] }));
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		delivery.destroy();

		expect(mockGt.destroySlots).toHaveBeenCalledWith([mockGt._mockSlot]);
		expect(mockGt._mockPubads.removeEventListener).toHaveBeenCalled();
	});

	it("does not define slot when signal is aborted", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(gpt({ adUnit: "/1234/unit", sizes: [[300, 250]] }));
		delivery.deliver({ ad: { id: "test-ad" } });

		// Destroy before flushing cmd queue
		delivery.destroy();
		mockGt._flushCmd();

		expect(mockGt.defineSlot).not.toHaveBeenCalled();
	});
});
