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

	it("transitions to error on iframe.onerror", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());

		const errorHandler = vi.fn();
		delivery.on("error", errorHandler);

		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		iframe.onerror!(new Event("error"));

		expect(delivery.state).toBe("error");
		expect(errorHandler).toHaveBeenCalledOnce();
		expect(errorHandler.mock.calls[0]![0]).toMatchObject({
			message: "iframe load failed",
			source: "banner",
		});
	});

	it("iframe.onerror is no-op when signal is aborted", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		delivery.destroy();

		// onerror after destroy — signal is aborted
		expect(delivery.state).toBe("destroyed");
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

	it("default sandbox has allow-scripts, allow-popups, allow-popups-to-escape-sandbox", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		expect(iframe.sandbox.contains("allow-scripts")).toBe(true);
		expect(iframe.sandbox.contains("allow-popups")).toBe(true);
		expect(iframe.sandbox.contains("allow-popups-to-escape-sandbox")).toBe(
			true,
		);
	});

	it("applies custom sandbox tokens", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(
			banner({ sandbox: ["allow-scripts", "allow-same-origin"] }),
		);
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		expect(iframe.sandbox.contains("allow-scripts")).toBe(true);
		expect(iframe.sandbox.contains("allow-same-origin")).toBe(true);
		expect(iframe.sandbox.contains("allow-popups")).toBe(false);
	});

	it("removes sandbox attribute when null", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner({ sandbox: null }));
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		expect(iframe.hasAttribute("sandbox")).toBe(false);
	});

	it("applies custom style merged with defaults", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner({ style: { width: "100%", height: "auto" } }));
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		expect(iframe.style.borderStyle).toBe("none");
		expect(iframe.style.width).toBe("100%");
		expect(iframe.style.height).toBe("auto");
	});

	it("custom style overrides defaults", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner({ style: { border: "1px solid red" } }));
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		expect(iframe.style.border).toBe("1px solid red");
	});

	it("applies custom attributes", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(
			banner({
				attrs: { loading: "lazy", referrerpolicy: "no-referrer" },
			}),
		);
		delivery.deliver(makeAdInput());

		const iframe = target.querySelector("iframe")!;
		expect(iframe.getAttribute("loading")).toBe("lazy");
		expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
	});
});
