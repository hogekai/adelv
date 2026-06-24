import { createDelivery } from "@adelv/adelv";
import type { DeliveryInput, PluginDelivery } from "@adelv/adelv";
import { EventTrackingMethod, EventType } from "iab-adcom/enum";
import type { Ad } from "iab-adcom/media";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsTracker } from "../src/js-tracker.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function adWithJsTrackers(): Ad {
	return {
		id: "js-ad",
		display: {
			adm: "<div>ad</div>",
			event: [
				{
					type: EventType.LOADED,
					method: EventTrackingMethod.JAVASCRIPT,
					url: "https://t.example.com/loaded.js",
				},
				{
					type: EventType.IMPRESSION,
					method: EventTrackingMethod.JAVASCRIPT,
					url: "https://t.example.com/imp.js",
				},
				{
					type: EventType.IMPRESSION,
					method: EventTrackingMethod.IMAGE_PIXEL,
					url: "https://t.example.com/imp.gif",
				},
				{
					type: EventType.VIEWABLE_MRC_50,
					method: EventTrackingMethod.JAVASCRIPT,
					url: "https://t.example.com/view50.js",
				},
				{
					type: EventType.VIEWABLE_MRC_100,
					method: EventTrackingMethod.JAVASCRIPT,
					url: "https://t.example.com/view100.js",
				},
			],
		},
	};
}

function setup(input?: DeliveryInput) {
	const target = document.createElement("div");
	const delivery = createDelivery(target, {
		logger: makeLogger(),
		sendBeacon: makeSendBeacon(),
	});
	let pd: PluginDelivery<HTMLElement> | undefined;
	delivery.use({
		name: "controller",
		setup(d) {
			pd = d;
			return undefined;
		},
	});
	delivery.use(jsTracker());
	delivery.deliver(input ?? { ad: adWithJsTrackers() });
	return { delivery, pd: pd!, target };
}

function scriptSrcs(target: HTMLElement): string[] {
	return [...target.querySelectorAll("script")].map((s) => s.src);
}

describe("jsTracker plugin", () => {
	afterEach(() => {
		for (const s of document.head.querySelectorAll("script")) {
			s.remove();
		}
	});

	it("injects LOADED and IMPRESSION JS trackers on rendered", () => {
		const { pd, target } = setup();
		pd.setState("rendering");
		pd.setState("rendered");

		const srcs = scriptSrcs(target);
		expect(srcs).toContain("https://t.example.com/loaded.js");
		expect(srcs).toContain("https://t.example.com/imp.js");
	});

	it("ignores IMAGE_PIXEL trackers", () => {
		const { pd, target } = setup();
		pd.setState("rendering");
		pd.setState("rendered");

		expect(scriptSrcs(target)).not.toContain("https://t.example.com/imp.gif");
	});

	it("injects the JS tracker matching the viewable standard", () => {
		const { pd, target } = setup();
		pd.setState("rendering");
		pd.setState("rendered");
		pd.emit("viewable", { ts: Date.now(), standard: "mrc100" });

		const srcs = scriptSrcs(target);
		expect(srcs).toContain("https://t.example.com/view100.js");
		expect(srcs).not.toContain("https://t.example.com/view50.js");
	});

	it("marks injected scripts async", () => {
		const { pd, target } = setup();
		pd.setState("rendering");
		pd.setState("rendered");

		const scripts = [...target.querySelectorAll("script")];
		expect(scripts.length).toBeGreaterThan(0);
		expect(scripts.every((s) => s.async)).toBe(true);
	});

	it("removes injected scripts on destroy", () => {
		const { delivery, pd, target } = setup();
		pd.setState("rendering");
		pd.setState("rendered");
		expect(target.querySelectorAll("script").length).toBeGreaterThan(0);

		delivery.destroy();
		expect(target.querySelectorAll("script").length).toBe(0);
	});

	it("supports mounting into document.head", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		let pd: PluginDelivery<HTMLElement> | undefined;
		delivery.use({
			name: "controller",
			setup(d) {
				pd = d;
				return undefined;
			},
		});
		delivery.use(jsTracker({ mount: "head" }));
		delivery.deliver({ ad: adWithJsTrackers() });
		pd!.setState("rendering");
		pd!.setState("rendered");

		const headSrcs = [...document.head.querySelectorAll("script")].map(
			(s) => s.src,
		);
		expect(headSrcs).toContain("https://t.example.com/imp.js");
		expect(target.querySelectorAll("script").length).toBe(0);
	});
});
