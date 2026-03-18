import { describe, expect, it, vi } from "vitest";
import { withConsent } from "../src/consent.js";
import { createDelivery } from "../src/delivery.js";
import type { PluginDelivery } from "../src/types.js";

function makeLogger() {
	return { warn: vi.fn() };
}

function makeSender() {
	return vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
}

describe("withConsent", () => {
	it("fires beacon when consent is granted", () => {
		const inner = makeSender();
		const delivery = createDelivery("target", {
			logger: makeLogger(),
			sendBeacon: withConsent(() => true, inner),
		});

		delivery.deliver({ ad: { id: "1" }, purl: "https://example.com/purl" });

		expect(inner).toHaveBeenCalledWith("https://example.com/purl");
	});

	it("blocks beacon and emits error when consent is denied", async () => {
		const inner = makeSender();
		const delivery = createDelivery("target", {
			logger: makeLogger(),
			sendBeacon: withConsent(() => false, inner),
		});

		const errorHandler = vi.fn();
		delivery.on("error", errorHandler);

		delivery.deliver({ ad: { id: "1" }, purl: "https://example.com/purl" });

		expect(inner).not.toHaveBeenCalled();

		await vi.waitFor(() => {
			expect(errorHandler).toHaveBeenCalled();
		});
		expect(errorHandler.mock.calls[0]![0].source).toBe("tracking");
		expect(errorHandler.mock.calls[0]![0].message).toContain(
			"Consent not granted",
		);
	});

	it("does not affect state transitions when consent is denied", async () => {
		const inner = makeSender();
		const delivery = createDelivery("target", {
			logger: makeLogger(),
			sendBeacon: withConsent(() => false, inner),
		});

		let pd: PluginDelivery<string> | undefined;
		delivery.use({
			name: "test",
			setup(d) {
				pd = d;
				return undefined;
			},
		});

		delivery.deliver({
			ad: { id: "1" },
			purl: "https://example.com/purl",
			burl: "https://example.com/burl",
		});
		pd!.setState("rendering");
		pd!.setState("rendered");

		expect(delivery.state).toBe("rendered");
		expect(inner).not.toHaveBeenCalled();
	});

	it("reflects dynamic consent changes between beacon fires", () => {
		let consent = false;
		const inner = makeSender();
		const delivery = createDelivery("target", {
			logger: makeLogger(),
			sendBeacon: withConsent(() => consent, inner),
		});

		let pd: PluginDelivery<string> | undefined;
		delivery.use({
			name: "test",
			setup(d) {
				pd = d;
				return undefined;
			},
		});

		delivery.deliver({
			ad: { id: "1" },
			purl: "https://example.com/purl",
			burl: "https://example.com/burl",
		});
		// purl denied
		expect(inner).not.toHaveBeenCalled();

		consent = true;
		pd!.setState("rendering");
		pd!.setState("rendered");
		// burl granted
		expect(inner).toHaveBeenCalledWith("https://example.com/burl");
	});
});
