import { createDelivery } from "@adelv/ortb3";
import type { PluginDelivery } from "@adelv/ortb3";
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

function fireIntersection(isIntersecting: boolean) {
	mockObserverCallback!([{ isIntersecting } as IntersectionObserverEntry]);
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

	it("emits viewable after 50% visible for 1 second", () => {
		const { delivery } = setupRenderedDelivery();
		const handler = vi.fn();
		delivery.on("viewable", handler);

		fireIntersection(true);
		vi.advanceTimersByTime(1000);

		expect(handler).toHaveBeenCalledOnce();
	});

	it("does not emit viewable if hidden before 1 second", () => {
		const { delivery } = setupRenderedDelivery();
		const handler = vi.fn();
		delivery.on("viewable", handler);

		fireIntersection(true);
		vi.advanceTimersByTime(500);
		fireIntersection(false);
		vi.advanceTimersByTime(1000);

		expect(handler).not.toHaveBeenCalled();
	});

	it("respects custom threshold and duration", () => {
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
		delivery.use(viewability({ threshold: 0.8, duration: 2000 }));
		delivery.deliver({ ad: { id: "test-ad" } });
		pd!.setState("rendering");
		pd!.setState("rendered");

		const handler = vi.fn();
		delivery.on("viewable", handler);

		fireIntersection(true);
		vi.advanceTimersByTime(1999);
		expect(handler).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(handler).toHaveBeenCalledOnce();

		// Verify threshold was passed to IntersectionObserver
		const MockIO = vi.mocked(IntersectionObserver);
		expect(MockIO.mock.calls[0]![1]).toEqual({ threshold: 0.8 });
	});

	it("disconnects observer and clears timer on cleanup", () => {
		const { delivery } = setupRenderedDelivery();

		fireIntersection(true);
		delivery.destroy();

		expect(mockObserverInstance!.disconnect).toHaveBeenCalled();
	});
});
