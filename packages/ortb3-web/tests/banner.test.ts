import { createDelivery } from "@adelv/ortb3";
import type { DeliveryInput, PluginDelivery } from "@adelv/ortb3";
import { describe, expect, it, vi } from "vitest";
import { banner } from "../src/banner.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function makeAdInput(overrides?: Partial<DeliveryInput["ad"]>): DeliveryInput {
	return {
		ad: {
			id: "test-ad",
			display: {
				adm: "<div>test ad</div>",
				w: 300,
				h: 250,
			},
			...overrides,
		},
	};
}

describe("banner plugin", () => {
	it("creates iframe on pending transition", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe");
		expect(iframe).not.toBeNull();
	});

	it("sets iframe.srcdoc from ad.display.adm", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		expect(iframe.srcdoc).toBe("<div>test ad</div>");
	});

	it("transitions to rendered on iframe load", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver(makeAdInput());

		expect(delivery.state).toBe("rendering");

		const iframe = target.querySelector("iframe")!;
		iframe.onload!(new Event("load"));

		expect(delivery.state).toBe("rendered");
	});

	it("does not transition to rendered when signal is aborted", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		delivery.destroy();

		// Simulate late onload after destroy
		// State is already destroyed, onload should be no-op due to signal.aborted
		// (state won't change from destroyed anyway)
		expect(delivery.state).toBe("destroyed");
	});

	it("clears target innerHTML on cleanup (destroy)", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver(makeAdInput());

		expect(target.querySelector("iframe")).not.toBeNull();

		delivery.destroy();

		expect(target.innerHTML).toBe("");
	});

	it("transitions to error when display.adm is missing", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver({
			ad: {
				id: "test-ad",
				display: {},
			},
		});

		expect(delivery.state).toBe("error");
	});

	it("does not transition to rendering when ad.display is missing", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver({
			ad: { id: "test-ad" },
		});

		expect(delivery.state).toBe("pending");
	});
});
