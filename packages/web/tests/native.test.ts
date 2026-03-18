import { createDelivery } from "@adelv/adelv";
import type { DeliveryInput } from "@adelv/adelv";
import { NativeDataAssetType, NativeImageAssetType } from "iab-adcom/enum";
import type { Ad } from "iab-adcom/media";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { native } from "../src/native.js";
import { viewability } from "../src/viewability.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSendBeacon() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

function createNativeAd(): Ad {
	return {
		id: "native-1",
		display: {
			native: {
				link: { url: "https://example.com/landing" },
				asset: [
					{ id: 1, title: { text: "Test Ad Title" } },
					{
						id: 2,
						image: {
							url: "https://example.com/img.jpg",
							type: NativeImageAssetType.MAIN,
						},
					},
					{
						id: 3,
						data: {
							value: "Test description",
							type: NativeDataAssetType.DESCRIPTION,
						},
					},
					{
						id: 4,
						data: {
							value: "Advertiser Inc.",
							type: NativeDataAssetType.SPONSORED,
						},
					},
				],
			},
		},
	};
}

function makeNativeInput(): DeliveryInput {
	return { ad: createNativeAd() };
}

describe("native plugin", () => {
	it("calls render and transitions to rendered", () => {
		const render = vi.fn();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});

		delivery.use(native({ render }));
		delivery.deliver(makeNativeInput());

		expect(render).toHaveBeenCalledOnce();
		expect(render).toHaveBeenCalledWith(target, makeNativeInput().ad);
		expect(delivery.state).toBe("rendered");
	});

	it("render function builds DOM correctly", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});

		delivery.use(
			native({
				render(t, ad) {
					const title =
						ad.display!.native!.asset?.find((a) => a.title)?.title?.text ?? "";
					t.innerHTML = `<h3>${title}</h3>`;
				},
			}),
		);
		delivery.deliver(makeNativeInput());

		expect(delivery.state).toBe("rendered");
		expect(target.innerHTML).toBe("<h3>Test Ad Title</h3>");
	});

	it("skips when ad.display?.native is absent", () => {
		const render = vi.fn();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});

		delivery.use(native({ render }));
		delivery.deliver({ ad: { id: "banner-ad", display: { adm: "<div>banner</div>" } } });

		expect(render).not.toHaveBeenCalled();
		expect(delivery.state).toBe("pending");
	});

	it("transitions to error when render throws", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});

		const errorHandler = vi.fn();
		delivery.on("error", errorHandler);

		delivery.use(
			native({
				render() {
					throw new Error("broken");
				},
			}),
		);
		delivery.deliver(makeNativeInput());

		expect(delivery.state).toBe("error");
		expect(errorHandler).toHaveBeenCalledOnce();
		expect(errorHandler.mock.calls[0]![0]).toMatchObject({
			source: "native",
		});
		expect(errorHandler.mock.calls[0]![0].message).toContain("broken");
	});

	it("calls render cleanup function on destroy", () => {
		const cleanup = vi.fn();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});

		delivery.use(
			native({
				render(t) {
					t.innerHTML = "<h3>native ad</h3>";
					return cleanup;
				},
			}),
		);
		delivery.deliver(makeNativeInput());

		expect(delivery.state).toBe("rendered");
		delivery.destroy();

		expect(cleanup).toHaveBeenCalledOnce();
	});

	it("uses default cleanup (innerHTML = '') when render returns void", () => {
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon: makeSendBeacon(),
		});

		delivery.use(
			native({
				render(t) {
					t.innerHTML = "<h3>native ad</h3>";
				},
			}),
		);
		delivery.deliver(makeNativeInput());

		expect(target.innerHTML).toBe("<h3>native ad</h3>");
		delivery.destroy();

		expect(target.innerHTML).toBe("");
	});

	it("works with viewability plugin", () => {
		vi.useFakeTimers();

		let mockObserverCallback: ((entries: IntersectionObserverEntry[]) => void) | null =
			null;
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((callback: (entries: IntersectionObserverEntry[]) => void) => {
				mockObserverCallback = callback;
				return { observe: vi.fn(), disconnect: vi.fn() };
			}),
		);

		const sendBeacon = makeSendBeacon();
		const target = document.createElement("div");
		const delivery = createDelivery(target, {
			logger: makeLogger(),
			sendBeacon,
		});

		const viewableHandler = vi.fn();
		delivery.on("viewable", viewableHandler);

		delivery.use(
			native({
				render(t) {
					t.innerHTML = "<h3>native</h3>";
				},
			}),
		);
		delivery.use(viewability());
		delivery.deliver(makeNativeInput());

		expect(delivery.state).toBe("rendered");

		// trigger viewability
		mockObserverCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);
		vi.advanceTimersByTime(1000);

		expect(viewableHandler).toHaveBeenCalledOnce();

		delivery.destroy();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
});
