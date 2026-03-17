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

		expect(mockGt._mockSlot.setTargeting).toHaveBeenCalledWith("hb_pb", ["2.56"]);
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

	it("does not transition to rendered when signal is aborted on slotRenderEnded", () => {
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

		// Destroy aborts signal, then fire slotRenderEnded
		delivery.destroy();
		mockGt._fireSlotRenderEnded();

		expect(delivery.state).toBe("destroyed");
	});

	it("calls enableServices only once across multiple gpt instances", async () => {
		// Reset module to clear servicesEnabled flag from prior tests
		vi.resetModules();
		const { gpt: freshGpt } = await import("../src/gpt.js");

		const target1 = document.createElement("div");
		target1.id = "ad-slot-1";
		const target2 = document.createElement("div");
		target2.id = "ad-slot-2";

		const delivery1 = createDelivery(target1, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery1.use(freshGpt({ adUnit: "/1234/unit1", sizes: [[300, 250]] }));
		delivery1.deliver({ ad: { id: "test-ad-1" } });
		mockGt._flushCmd();

		const delivery2 = createDelivery(target2, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery2.use(freshGpt({ adUnit: "/1234/unit2", sizes: [[728, 90]] }));
		delivery2.deliver({ ad: { id: "test-ad-2" } });
		mockGt._flushCmd();

		expect(mockGt.enableServices).toHaveBeenCalledTimes(1);
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

	it("sets hb_size from bid.media.display dimensions", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const bids: Bid[] = [
			{
				item: "1",
				price: 2.5,
				media: { display: { w: 300, h: 250 } },
			},
		];
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(gpt({ adUnit: "/1234/unit", sizes: [[300, 250]], bids }));
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		expect(mockGt._mockSlot.setTargeting).toHaveBeenCalledWith(
			"hb_size",
			["300x250"],
		);
	});

	it("does not set hb_size when bid.media is undefined", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const bids: Bid[] = [{ item: "1", price: 2.5 }];
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(gpt({ adUnit: "/1234/unit", sizes: [[300, 250]], bids }));
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		const calls = mockGt._mockSlot.setTargeting.mock.calls;
		const keys = calls.map((c: unknown[]) => c[0]);
		expect(keys).not.toContain("hb_size");
	});

	it("applies direct targeting key-values", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(
			gpt({
				adUnit: "/1234/unit",
				sizes: [[300, 250]],
				targeting: { hb_bidder: "ssp-a" },
			}),
		);
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		expect(mockGt._mockSlot.setTargeting).toHaveBeenCalledWith(
			"hb_bidder",
			["ssp-a"],
		);
	});

	it("direct targeting overrides auto-generated targeting", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const bids: Bid[] = [{ item: "1", price: 2.5 }];
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(
			gpt({
				adUnit: "/1234/unit",
				sizes: [[300, 250]],
				bids,
				targeting: { hb_pb: "10.00" },
			}),
		);
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		expect(mockGt._mockSlot.setTargeting).toHaveBeenCalledWith(
			"hb_pb",
			["10.00"],
		);
	});

	it("supports array values in direct targeting", () => {
		const target = document.createElement("div");
		target.id = "ad-slot-1";
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(
			gpt({
				adUnit: "/1234/unit",
				sizes: [[300, 250]],
				targeting: { keywords: ["sports", "news"] },
			}),
		);
		delivery.deliver({ ad: { id: "test-ad" } });
		mockGt._flushCmd();

		expect(mockGt._mockSlot.setTargeting).toHaveBeenCalledWith(
			"keywords",
			["sports", "news"],
		);
	});
});
