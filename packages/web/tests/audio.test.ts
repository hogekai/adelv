import { createDelivery } from "@adelv/adelv";
import type { DeliveryInput } from "@adelv/adelv";
import type { Ad } from "iab-adcom/media";
import { describe, expect, it, vi } from "vitest";
import { audio } from "../src/audio.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function audioAd(): Ad {
	return {
		id: "audio-1",
		audio: { adm: "<DAAST></DAAST>", dur: 30 },
	};
}

function setup(render: (t: HTMLElement, ad: Ad) => (() => void) | undefined) {
	const target = document.createElement("div");
	const delivery = createDelivery(target, {
		logger: makeLogger(),
		sendBeacon: makeSendBeacon(),
	});
	delivery.use(audio({ render }));
	return { delivery, target };
}

describe("audio plugin", () => {
	it("calls render with the DAAST ad and transitions to rendered", () => {
		const render = vi.fn();
		const { delivery, target } = setup(render);
		const input: DeliveryInput = { ad: audioAd() };
		delivery.deliver(input);

		expect(render).toHaveBeenCalledOnce();
		expect(render).toHaveBeenCalledWith(target, input.ad);
		expect(delivery.state).toBe("rendered");
	});

	it("skips when ad.audio is absent", () => {
		const render = vi.fn();
		const { delivery } = setup(render);
		delivery.deliver({
			ad: { id: "display", display: { adm: "<div></div>" } },
		});

		expect(render).not.toHaveBeenCalled();
		expect(delivery.state).toBe("pending");
	});

	it("transitions to error when render throws", () => {
		const errorHandler = vi.fn();
		const { delivery } = setup(() => {
			throw new Error("audio boom");
		});
		delivery.on("error", errorHandler);
		delivery.deliver({ ad: audioAd() });

		expect(delivery.state).toBe("error");
		expect(errorHandler.mock.calls[0]![0]).toMatchObject({ source: "audio" });
		expect(errorHandler.mock.calls[0]![0].message).toContain("audio boom");
	});

	it("calls render cleanup on destroy", () => {
		const cleanup = vi.fn();
		const { delivery } = setup(() => cleanup);
		delivery.deliver({ ad: audioAd() });

		delivery.destroy();
		expect(cleanup).toHaveBeenCalledOnce();
	});
});
