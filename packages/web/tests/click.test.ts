import { createDelivery } from "@adelv/adelv";
import type { DeliveryInput } from "@adelv/adelv";
import { describe, expect, it, vi } from "vitest";
import { banner } from "../src/banner.js";
import { click } from "../src/click.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function makeBannerAdInput(overrides?: Partial<DeliveryInput>): DeliveryInput {
	return {
		ad: {
			id: "test-ad",
			display: {
				adm: "<div>test ad</div>",
				w: 300,
				h: 250,
				banner: {
					link: {
						url: "https://example.com/landing",
						trkr: ["https://track.example.com/click"],
					},
				},
			},
		},
		...overrides,
	};
}

function makeNativeAdInput(): DeliveryInput {
	return {
		ad: {
			id: "test-native-ad",
			display: {
				native: {
					link: {
						url: "https://example.com/native-landing",
					},
				},
			},
		},
	};
}

function setupRendered(input?: DeliveryInput) {
	const target = document.createElement("div");
	const delivery = createDelivery(target, {
		logger: makeLogger(),
		sendBeacon: makeSendBeacon(),
	});
	delivery.use(banner());
	delivery.use(click());
	delivery.deliver(input ?? makeBannerAdInput());

	// banner transitions to rendering, fire iframe onload to get to rendered
	const iframe = target.querySelector("iframe");
	if (iframe) {
		iframe.onload!(new Event("load"));
	}

	return { delivery, target };
}

describe("click plugin", () => {
	it("emits click event on target click after rendered", () => {
		const { delivery, target } = setupRendered();

		const handler = vi.fn();
		delivery.on("click", handler);

		target.click();

		expect(handler).toHaveBeenCalledOnce();
		expect(handler.mock.calls[0]![0]).toMatchObject({
			url: "https://example.com/landing",
		});
	});

	it("does not emit click before rendered", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.use(click());
		delivery.deliver(makeBannerAdInput());

		// State is rendering, not rendered
		expect(delivery.state).toBe("rendering");

		const handler = vi.fn();
		delivery.on("click", handler);

		target.click();

		expect(handler).not.toHaveBeenCalled();
	});

	it("does not emit click when landing URL is missing", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		delivery.use(banner());
		delivery.use(click());
		delivery.deliver({
			ad: {
				id: "test-ad",
				display: {
					adm: "<div>test</div>",
				},
			},
		});

		const iframe = target.querySelector("iframe")!;
		iframe.onload!(new Event("load"));

		const handler = vi.fn();
		delivery.on("click", handler);

		target.click();

		expect(handler).not.toHaveBeenCalled();
	});

	it("extracts landing URL from native ad", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});
		// Use a test plugin to drive state since native ad has no adm for banner
		delivery.use({
			name: "test-renderer",
			setup(d) {
				d.on("statechange", ({ to }) => {
					if (to === "pending") {
						d.setState("rendering");
						d.setState("rendered");
					}
				});
				return undefined;
			},
		});
		delivery.use(click());
		delivery.deliver(makeNativeAdInput());

		const handler = vi.fn();
		delivery.on("click", handler);

		target.click();

		expect(handler).toHaveBeenCalledOnce();
		expect(handler.mock.calls[0]![0]).toMatchObject({
			url: "https://example.com/native-landing",
		});
	});

	it("does not emit click after destroy (cleanup)", () => {
		const { delivery, target } = setupRendered();

		const handler = vi.fn();
		delivery.on("click", handler);

		delivery.destroy();
		target.click();

		expect(handler).not.toHaveBeenCalled();
	});

	describe("iframe focus detection", () => {
		it("emits click when window blurs and activeElement is iframe in target", () => {
			const { delivery, target } = setupRendered();

			const handler = vi.fn();
			delivery.on("click", handler);

			const iframe = target.querySelector("iframe")!;
			Object.defineProperty(document, "activeElement", {
				value: iframe,
				configurable: true,
			});

			window.dispatchEvent(new Event("blur"));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0]![0]).toMatchObject({
				url: "https://example.com/landing",
			});

			// Restore
			Object.defineProperty(document, "activeElement", {
				value: document.body,
				configurable: true,
			});
		});

		it("prevents duplicate blur detection until focus reset", () => {
			const { delivery, target } = setupRendered();

			const handler = vi.fn();
			delivery.on("click", handler);

			const iframe = target.querySelector("iframe")!;
			Object.defineProperty(document, "activeElement", {
				value: iframe,
				configurable: true,
			});

			window.dispatchEvent(new Event("blur"));
			window.dispatchEvent(new Event("blur"));

			expect(handler).toHaveBeenCalledTimes(1);

			// Reset via focus event
			window.dispatchEvent(new Event("focus"));

			// Now blur again should fire
			window.dispatchEvent(new Event("blur"));

			expect(handler).toHaveBeenCalledTimes(2);

			Object.defineProperty(document, "activeElement", {
				value: document.body,
				configurable: true,
			});
		});

		it("does not emit when activeElement is not an iframe in target", () => {
			const { delivery } = setupRendered();

			const handler = vi.fn();
			delivery.on("click", handler);

			// activeElement is body, not an iframe
			window.dispatchEvent(new Event("blur"));

			expect(handler).not.toHaveBeenCalled();
		});
	});
});
