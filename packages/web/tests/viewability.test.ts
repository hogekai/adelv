import { createDelivery } from "@adelv/adelv";
import type { PluginDelivery } from "@adelv/adelv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { viewability } from "../src/viewability.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

// IntersectionObserver mock
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let mockObserverCallback: IOCallback | null = null;
let mockObserverInstance: {
	observe: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
} | null = null;

function setupMockIntersectionObserver() {
	mockObserverCallback = null;
	mockObserverInstance = null;

	const MockIO = vi.fn((callback: IOCallback) => {
		mockObserverCallback = callback;
		mockObserverInstance = {
			observe: vi.fn(),
			disconnect: vi.fn(),
		};
		return mockObserverInstance;
	});

	vi.stubGlobal("IntersectionObserver", MockIO);
	return MockIO;
}

function fireIntersection(isIntersecting: boolean, intersectionRatio = 1) {
	mockObserverCallback!([
		{
			isIntersecting,
			intersectionRatio: isIntersecting ? intersectionRatio : 0,
		} as IntersectionObserverEntry,
	]);
}

function setupRenderedDelivery() {
	const target = document.createElement("div");
	const delivery = createDelivery(target, {
		logger: makeLogger(),
		sendBeacon: makeSendBeacon(),
	});
	let pd: PluginDelivery<HTMLElement> | undefined;
	delivery.use({
		name: "test-controller",
		setup(d) {
			pd = d;
			return undefined;
		},
	});
	delivery.use(viewability());
	delivery.deliver({ ad: { id: "test-ad" } });
	pd!.setState("rendering");
	pd!.setState("rendered");
	return { delivery, pd: pd!, target };
}

function setupStandardsDelivery(standards: ("mrc50" | "mrc100" | "video50")[]) {
	const target = document.createElement("div");
	const delivery = createDelivery(target, {
		logger: makeLogger(),
		sendBeacon: makeSendBeacon(),
	});
	let pd: PluginDelivery<HTMLElement> | undefined;
	delivery.use({
		name: "test-controller",
		setup(d) {
			pd = d;
			return undefined;
		},
	});
	delivery.use(viewability({ standards }));
	delivery.deliver({ ad: { id: "test-ad" } });
	pd!.setState("rendering");
	pd!.setState("rendered");
	return { delivery, pd: pd!, target };
}

describe("viewability plugin", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setupMockIntersectionObserver();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("creates IntersectionObserver after rendered", () => {
		setupRenderedDelivery();
		expect(mockObserverInstance).not.toBeNull();
		expect(mockObserverInstance!.observe).toHaveBeenCalled();
	});

	it("emits viewable(mrc50) after 50% visible for 1 second", () => {
		const { delivery } = setupRenderedDelivery();
		const handler = vi.fn();
		delivery.on("viewable", handler);

		fireIntersection(true, 0.5);
		vi.advanceTimersByTime(1000);

		expect(handler).toHaveBeenCalledOnce();
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({ standard: "mrc50" }),
		);
	});

	it("does not emit viewable if hidden before 1 second", () => {
		const { delivery } = setupRenderedDelivery();
		const handler = vi.fn();
		delivery.on("viewable", handler);

		fireIntersection(true, 0.5);
		vi.advanceTimersByTime(500);
		fireIntersection(false);
		vi.advanceTimersByTime(1000);

		expect(handler).not.toHaveBeenCalled();
	});

	it("passes all distinct standard ratios as observer thresholds", () => {
		setupStandardsDelivery(["mrc50", "mrc100"]);
		const MockIO = vi.mocked(IntersectionObserver);
		expect(MockIO.mock.calls[0]![1]).toEqual({ threshold: [0.5, 1.0] });
	});

	it("emits each requested standard once when its criteria are met", () => {
		const { delivery } = setupStandardsDelivery(["mrc50", "mrc100"]);
		const handler = vi.fn();
		delivery.on("viewable", handler);

		// 50% visible: only mrc50 should fire after 1s.
		fireIntersection(true, 0.5);
		vi.advanceTimersByTime(1000);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenLastCalledWith(
			expect.objectContaining({ standard: "mrc50" }),
		);

		// Now 100% visible for 1s: mrc100 fires.
		fireIntersection(true, 1.0);
		vi.advanceTimersByTime(1000);
		expect(handler).toHaveBeenCalledTimes(2);
		expect(handler).toHaveBeenLastCalledWith(
			expect.objectContaining({ standard: "mrc100" }),
		);
	});

	it("video50 requires 2 continuous seconds", () => {
		const { delivery } = setupStandardsDelivery(["video50"]);
		const handler = vi.fn();
		delivery.on("viewable", handler);

		fireIntersection(true, 0.5);
		vi.advanceTimersByTime(1999);
		expect(handler).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(handler).toHaveBeenCalledOnce();
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({ standard: "video50" }),
		);
	});

	it("disconnects observer once all standards have fired", () => {
		const { delivery } = setupStandardsDelivery(["mrc50"]);
		const handler = vi.fn();
		delivery.on("viewable", handler);

		fireIntersection(true, 0.5);
		vi.advanceTimersByTime(1000);

		expect(handler).toHaveBeenCalledOnce();
		expect(mockObserverInstance!.disconnect).toHaveBeenCalled();
	});

	it("disconnects observer and clears timers on cleanup", () => {
		const { delivery } = setupRenderedDelivery();

		fireIntersection(true, 0.5);
		delivery.destroy();

		expect(mockObserverInstance!.disconnect).toHaveBeenCalled();
	});
});
