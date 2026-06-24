import { EventTrackingMethod, EventType } from "iab-adcom/enum";
import type { Ad } from "iab-adcom/media";
import { describe, expect, it, vi } from "vitest";
import { createDelivery } from "../src/delivery.js";
import { getEventUrls, viewableEventType } from "../src/tracking.js";
import type { DeliveryInput, PluginDelivery } from "../src/types.js";

function createTestAd(overrides?: Partial<Ad>): Ad {
	return {
		id: "test-ad-1",
		...overrides,
	};
}

function createTestAdWithTrackers(): Ad {
	return createTestAd({
		display: {
			adm: "<div>ad</div>",
			event: [
				{
					type: EventType.LOADED,
					method: EventTrackingMethod.IMAGE_PIXEL,
					url: "https://track.example.com/loaded",
				},
				{
					type: EventType.IMPRESSION,
					method: EventTrackingMethod.IMAGE_PIXEL,
					url: "https://track.example.com/imp",
				},
				{
					type: EventType.VIEWABLE_MRC_50,
					method: EventTrackingMethod.IMAGE_PIXEL,
					url: "https://track.example.com/view",
				},
				{
					type: EventType.VIEWABLE_MRC_100,
					method: EventTrackingMethod.IMAGE_PIXEL,
					url: "https://track.example.com/view100",
				},
				{
					type: EventType.VIEWABLE_VIDEO_50,
					method: EventTrackingMethod.IMAGE_PIXEL,
					url: "https://track.example.com/viewvid",
				},
				{
					type: EventType.IMPRESSION,
					method: EventTrackingMethod.JAVASCRIPT,
					url: "https://track.example.com/imp.js",
				},
			],
			banner: {
				img: "https://example.com/ad.jpg",
				link: {
					url: "https://example.com",
					trkr: ["https://track.example.com/click1"],
				},
			},
		},
	});
}

function makeInput(ad?: Ad, overrides?: Partial<DeliveryInput>): DeliveryInput {
	return { ad: ad ?? createTestAd(), ...overrides };
}

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function setupWithPlugin(options?: {
	ad?: Ad;
	purl?: string;
	burl?: string;
	sendBeacon?: ReturnType<typeof makeSendBeacon>;
}) {
	const sendBeacon = options?.sendBeacon ?? makeSendBeacon();
	const delivery = createDelivery("target", {
		logger: makeLogger(),
		sendBeacon,
	});
	let pd: PluginDelivery<string> | undefined;
	delivery.use({
		name: "test",
		setup(d) {
			pd = d;
			return undefined;
		},
	});
	const ad = options?.ad ?? createTestAdWithTrackers();
	delivery.deliver(makeInput(ad, { purl: options?.purl, burl: options?.burl }));
	return { delivery, pd: pd!, sendBeacon };
}

describe("tracking", () => {
	describe("purl on pending", () => {
		it("fires purl beacon on deliver()", () => {
			const { sendBeacon } = setupWithPlugin({
				purl: "https://example.com/purl",
			});

			expect(sendBeacon).toHaveBeenCalledWith("https://example.com/purl");
		});

		it("does not fire beacon when purl is not set", () => {
			const { sendBeacon } = setupWithPlugin();

			expect(sendBeacon).not.toHaveBeenCalled();
		});
	});

	describe("burl + impression trackers on rendered", () => {
		it("fires burl beacon on rendered", () => {
			const { pd, sendBeacon } = setupWithPlugin({
				burl: "https://example.com/burl",
			});
			pd.setState("rendering");

			sendBeacon.mockClear();
			pd.setState("rendered");

			expect(sendBeacon).toHaveBeenCalledWith("https://example.com/burl");
		});

		it("fires IMAGE_PIXEL IMPRESSION event trackers on rendered", () => {
			const { pd, sendBeacon } = setupWithPlugin({
				burl: "https://example.com/burl",
			});
			pd.setState("rendering");

			sendBeacon.mockClear();
			pd.setState("rendered");

			expect(sendBeacon).toHaveBeenCalledWith("https://track.example.com/imp");
		});

		it("fires LOADED event trackers on rendered", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");

			sendBeacon.mockClear();
			pd.setState("rendered");

			expect(sendBeacon).toHaveBeenCalledWith(
				"https://track.example.com/loaded",
			);
		});

		it("does not fire JAVASCRIPT method trackers", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");

			sendBeacon.mockClear();
			pd.setState("rendered");

			const calledUrls = sendBeacon.mock.calls.map((c) => c[0]);
			expect(calledUrls).not.toContain("https://track.example.com/imp.js");
		});
	});

	describe("viewable trackers", () => {
		it("fires VIEWABLE_MRC_50 trackers for the mrc50 standard", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");
			pd.setState("rendered");

			sendBeacon.mockClear();
			pd.emit("viewable", { ts: Date.now(), standard: "mrc50" });

			expect(sendBeacon).toHaveBeenCalledWith("https://track.example.com/view");
		});

		it("fires VIEWABLE_MRC_100 trackers for the mrc100 standard", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");
			pd.setState("rendered");

			sendBeacon.mockClear();
			pd.emit("viewable", { ts: Date.now(), standard: "mrc100" });

			expect(sendBeacon).toHaveBeenCalledWith(
				"https://track.example.com/view100",
			);
		});

		it("fires VIEWABLE_VIDEO_50 trackers for the video50 standard", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");
			pd.setState("rendered");

			sendBeacon.mockClear();
			pd.emit("viewable", { ts: Date.now(), standard: "video50" });

			expect(sendBeacon).toHaveBeenCalledWith(
				"https://track.example.com/viewvid",
			);
		});

		it("fires each standard only once (per-standard dedup)", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");
			pd.setState("rendered");

			sendBeacon.mockClear();
			pd.emit("viewable", { ts: 1, standard: "mrc50" });
			pd.emit("viewable", { ts: 2, standard: "mrc50" });

			expect(sendBeacon).toHaveBeenCalledTimes(1);
		});

		it("fires different standards independently", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");
			pd.setState("rendered");

			sendBeacon.mockClear();
			pd.emit("viewable", { ts: 1, standard: "mrc50" });
			pd.emit("viewable", { ts: 2, standard: "mrc100" });

			const urls = sendBeacon.mock.calls.map((c) => c[0]);
			expect(urls).toContain("https://track.example.com/view");
			expect(urls).toContain("https://track.example.com/view100");
		});
	});

	describe("click trackers", () => {
		it("fires LinkAsset.trkr on click", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");
			pd.setState("rendered");

			sendBeacon.mockClear();
			pd.emit("click", { ts: Date.now(), url: "https://example.com" });

			expect(sendBeacon).toHaveBeenCalledWith(
				"https://track.example.com/click1",
			);
		});

		it("fires click trackers multiple times", () => {
			const { pd, sendBeacon } = setupWithPlugin();
			pd.setState("rendering");
			pd.setState("rendered");

			sendBeacon.mockClear();
			pd.emit("click", { ts: 1, url: "https://example.com" });
			pd.emit("click", { ts: 2, url: "https://example.com" });
			pd.emit("click", { ts: 3, url: "https://example.com" });

			expect(sendBeacon).toHaveBeenCalledTimes(3);
		});
	});

	describe("beacon failure", () => {
		it("does not affect state and emits error event with source tracking", async () => {
			const sendBeacon = makeSendBeacon();
			sendBeacon.mockRejectedValue(new Error("network error"));
			const { delivery, pd } = setupWithPlugin({
				burl: "https://example.com/burl",
				sendBeacon,
			});
			pd.setState("rendering");

			const errorHandler = vi.fn();
			delivery.on("error", errorHandler);

			pd.setState("rendered");

			// Wait for the rejected promise to propagate
			await vi.waitFor(() => {
				expect(errorHandler).toHaveBeenCalled();
			});

			expect(delivery.state).toBe("rendered");
			expect(errorHandler.mock.calls[0]![0]).toMatchObject({
				source: "tracking",
			});
			expect(errorHandler.mock.calls[0]![0].message).toContain("network error");
		});
	});

	describe("getEventUrls", () => {
		it("returns IMAGE_PIXEL URLs by default", () => {
			const urls = getEventUrls(
				createTestAdWithTrackers(),
				EventType.IMPRESSION,
			);
			expect(urls).toEqual(["https://track.example.com/imp"]);
		});

		it("extracts JAVASCRIPT URLs when method is JAVASCRIPT", () => {
			const urls = getEventUrls(
				createTestAdWithTrackers(),
				EventType.IMPRESSION,
				EventTrackingMethod.JAVASCRIPT,
			);
			expect(urls).toEqual(["https://track.example.com/imp.js"]);
		});

		it("returns [] when the ad has no display events", () => {
			expect(getEventUrls(createTestAd(), EventType.IMPRESSION)).toEqual([]);
		});
	});

	describe("viewableEventType", () => {
		it("maps standards to AdCOM EventType", () => {
			expect(viewableEventType("mrc50")).toBe(EventType.VIEWABLE_MRC_50);
			expect(viewableEventType("mrc100")).toBe(EventType.VIEWABLE_MRC_100);
			expect(viewableEventType("video50")).toBe(EventType.VIEWABLE_VIDEO_50);
		});
	});
});
