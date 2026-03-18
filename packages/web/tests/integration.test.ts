import { createDelivery } from "@adelv/adelv";
import type { DeliveryInput, PluginDelivery } from "@adelv/adelv";
import { EventTrackingMethod, EventType } from "iab-adcom/enum";
import type { Ad } from "iab-adcom/media";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banner } from "../src/banner.js";
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
	vi.stubGlobal(
		"IntersectionObserver",
		vi.fn((callback: IOCallback) => {
			mockObserverCallback = callback;
			mockObserverInstance = {
				observe: vi.fn(),
				disconnect: vi.fn(),
			};
			return mockObserverInstance;
		}),
	);
}

function fireIntersection(isIntersecting: boolean) {
	mockObserverCallback!([{ isIntersecting } as IntersectionObserverEntry]);
}

const testAd: Ad = {
	id: "test-1",
	display: {
		adm: "<div>test ad</div>",
		event: [
			{
				type: EventType.IMPRESSION,
				method: EventTrackingMethod.IMAGE_PIXEL,
				url: "https://t.example.com/imp",
			},
			{
				type: EventType.VIEWABLE_MRC_50,
				method: EventTrackingMethod.IMAGE_PIXEL,
				url: "https://t.example.com/view",
			},
		],
		banner: {
			img: "https://example.com/ad.jpg",
			link: {
				url: "https://example.com/landing",
				trkr: ["https://t.example.com/click"],
			},
		},
	},
};

function makeTestInput(): DeliveryInput {
	return {
		ad: testAd,
		purl: "https://t.example.com/purl",
		burl: "https://t.example.com/burl",
	};
}

describe("integration", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setupMockIntersectionObserver();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("full web flow: deliver → pending → rendering → rendered → viewable → destroy", () => {
		const sendBeacon = makeSendBeacon();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon,
		});

		const stateLog: string[] = [];
		delivery.on("statechange", ({ to }) => stateLog.push(to));

		const impressionHandler = vi.fn();
		const viewableHandler = vi.fn();
		const destroyHandler = vi.fn();
		delivery.on("impression", impressionHandler);
		delivery.on("viewable", viewableHandler);
		delivery.on("destroy", destroyHandler);

		delivery.use(banner());
		delivery.use(viewability());
		delivery.deliver(makeTestInput());

		// pending
		expect(delivery.state).toBe("rendering"); // banner auto-advances to rendering
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/purl");

		// iframe onload → rendered
		const iframe = target.querySelector("iframe")!;
		sendBeacon.mockClear();
		iframe.onload!(new Event("load"));

		expect(delivery.state).toBe("rendered");
		expect(impressionHandler).toHaveBeenCalledOnce();
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/burl");
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/imp");

		// viewable
		sendBeacon.mockClear();
		fireIntersection(true);
		vi.advanceTimersByTime(1000);

		expect(viewableHandler).toHaveBeenCalledOnce();
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/view");

		// destroy
		delivery.destroy();
		expect(delivery.state).toBe("destroyed");
		expect(destroyHandler).toHaveBeenCalledOnce();
		expect(target.innerHTML).toBe("");

		expect(stateLog).toEqual(["pending", "rendering", "rendered", "destroyed"]);
	});

	it("tracking integration: purl → burl + imp → viewable → click", () => {
		const sendBeacon = makeSendBeacon();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon,
		});

		let pd: PluginDelivery<HTMLElement> | undefined;
		delivery.use({
			name: "test-controller",
			setup(d) {
				pd = d;
				return undefined;
			},
		});
		delivery.deliver(makeTestInput());

		// purl on pending
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/purl");

		sendBeacon.mockClear();
		pd!.setState("rendering");
		pd!.setState("rendered");

		// burl + impression tracker on rendered
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/burl");
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/imp");

		sendBeacon.mockClear();
		pd!.emit("viewable", { ts: Date.now() });

		// viewable tracker
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/view");

		sendBeacon.mockClear();
		pd!.emit("click", { ts: Date.now(), url: "https://example.com/landing" });

		// click tracker
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/click");
	});

	it("error path: rendering timeout", () => {
		const sendBeacon = makeSendBeacon();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon,
			renderingTimeout: 100,
		});

		let signal: AbortSignal | undefined;
		delivery.use({
			name: "dummy",
			setup(d, s) {
				signal = s;
				d.on("statechange", ({ to }) => {
					if (to === "pending") d.setState("rendering");
				});
				return undefined;
			},
		});

		const errorHandler = vi.fn();
		delivery.on("error", errorHandler);
		delivery.deliver({ ad: { id: "test-ad" } });

		expect(delivery.state).toBe("rendering");

		vi.advanceTimersByTime(100);

		expect(delivery.state).toBe("error");
		expect(signal!.aborted).toBe(true);
		expect(errorHandler).toHaveBeenCalled();
		expect(errorHandler.mock.calls[0]![0]).toMatchObject({
			source: "timeout",
		});

		delivery.destroy();
		expect(delivery.state).toBe("destroyed");
	});

	it("destroy stops all activity", () => {
		const sendBeacon = makeSendBeacon();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon,
		});

		let pd: PluginDelivery<HTMLElement> | undefined;
		delivery.use({
			name: "test-controller",
			setup(d) {
				pd = d;
				return undefined;
			},
		});
		delivery.deliver(makeTestInput());
		pd!.setState("rendering");
		pd!.setState("rendered");
		delivery.destroy();

		const viewableHandler = vi.fn();
		delivery.on("viewable", viewableHandler);
		pd!.emit("viewable", { ts: Date.now() });

		expect(viewableHandler).not.toHaveBeenCalled();
		expect(delivery.state).toBe("destroyed");
	});

	it("plugin registration order: banner → viewability and viewability → banner both work", () => {
		// Order 1: banner → viewability
		{
			const target = document.createElement("div");
			const delivery = createDelivery(target, {
				logger: makeLogger(),
				sendBeacon: makeSendBeacon(),
			});
			delivery.use(banner());
			delivery.use(viewability());
			delivery.deliver({ ad: testAd });

			const iframe = target.querySelector("iframe")!;
			iframe.onload!(new Event("load"));
			expect(delivery.state).toBe("rendered");
			expect(mockObserverInstance).not.toBeNull();
			delivery.destroy();
		}

		// Reset IO mock
		setupMockIntersectionObserver();

		// Order 2: viewability → banner
		{
			const target = document.createElement("div");
			const delivery = createDelivery(target, {
				logger: makeLogger(),
				sendBeacon: makeSendBeacon(),
			});
			delivery.use(viewability());
			delivery.use(banner());
			delivery.deliver({ ad: testAd });

			const iframe = target.querySelector("iframe")!;
			iframe.onload!(new Event("load"));
			expect(delivery.state).toBe("rendered");
			expect(mockObserverInstance).not.toBeNull();
			delivery.destroy();
		}
	});

	it("beacon failure does not block flow, emits error with source tracking", async () => {
		const sendBeacon = makeSendBeacon();
		sendBeacon.mockImplementation((url: string) => {
			if (url.includes("/burl")) {
				return Promise.reject(new Error("network error"));
			}
			return Promise.resolve();
		});

		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon,
		});

		let pd: PluginDelivery<HTMLElement> | undefined;
		delivery.use({
			name: "test-controller",
			setup(d) {
				pd = d;
				return undefined;
			},
		});

		const errorHandler = vi.fn();
		delivery.on("error", errorHandler);

		delivery.deliver(makeTestInput());
		pd!.setState("rendering");
		pd!.setState("rendered");

		// State proceeds normally despite burl failure
		expect(delivery.state).toBe("rendered");

		// Wait for rejected promise to propagate
		await vi.waitFor(() => {
			expect(errorHandler).toHaveBeenCalled();
		});

		expect(errorHandler.mock.calls[0]![0]).toMatchObject({
			source: "tracking",
		});
	});
});
