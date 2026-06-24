import { createDelivery } from "@adelv/adelv";
import type { DeliveryInput } from "@adelv/adelv";
import type { Ad } from "iab-adcom/media";
import { describe, expect, it, vi } from "vitest";
import { video } from "../src/video.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function videoAd(): Ad {
	return {
		id: "video-1",
		video: { adm: "<VAST></VAST>", dur: 15 },
	};
}

function setup(render: (t: HTMLElement, ad: Ad) => (() => void) | undefined) {
	const target = document.createElement("div");
	const delivery = createDelivery(target, {
		logger: makeLogger(),
		sendBeacon: makeSendBeacon(),
	});
	delivery.use(video({ render }));
	return { delivery, target };
}

describe("video plugin", () => {
	it("calls render with the VAST ad and transitions to rendered", () => {
		const render = vi.fn();
		const { delivery, target } = setup(render);
		const input: DeliveryInput = { ad: videoAd() };
		delivery.deliver(input);

		expect(render).toHaveBeenCalledOnce();
		expect(render).toHaveBeenCalledWith(target, input.ad);
		expect(delivery.state).toBe("rendered");
	});

	it("skips when ad.video is absent", () => {
		const render = vi.fn();
		const { delivery } = setup(render);
		delivery.deliver({
			ad: { id: "display", display: { adm: "<div></div>" } },
		});

		expect(render).not.toHaveBeenCalled();
		expect(delivery.state).toBe("pending");
	});

	it("fires burl on rendered (video has no event[] — tracking is in VAST)", () => {
		const sendBeacon = makeSendBeacon();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon,
		});
		delivery.use(video({ render: () => undefined }));
		delivery.deliver({ ad: videoAd(), burl: "https://t.example.com/burl" });

		expect(delivery.state).toBe("rendered");
		expect(sendBeacon).toHaveBeenCalledWith("https://t.example.com/burl");
	});

	it("transitions to error when render throws", () => {
		const errorHandler = vi.fn();
		const { delivery } = setup(() => {
			throw new Error("player boom");
		});
		delivery.on("error", errorHandler);
		delivery.deliver({ ad: videoAd() });

		expect(delivery.state).toBe("error");
		expect(errorHandler.mock.calls[0]![0]).toMatchObject({ source: "video" });
		expect(errorHandler.mock.calls[0]![0].message).toContain("player boom");
	});

	it("calls render cleanup on destroy", () => {
		const cleanup = vi.fn();
		const { delivery } = setup(() => cleanup);
		delivery.deliver({ ad: videoAd() });

		delivery.destroy();
		expect(cleanup).toHaveBeenCalledOnce();
	});
});
