import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDelivery } from "../src/delivery.js";
import type {
	DeliveryInput,
	DeliveryPlugin,
	PluginDelivery,
} from "../src/types.js";

const mockAd = {} as DeliveryInput["ad"];

function makeInput(overrides?: Partial<DeliveryInput>): DeliveryInput {
	return { ad: mockAd, ...overrides };
}

function makeLogger() {
	return { warn: vi.fn() };
}

describe("createDelivery", () => {
	describe("initial state", () => {
		it("starts in idle with null input", () => {
			const target = { id: "slot-1" };
			const delivery = createDelivery(target, { logger: makeLogger() });

			expect(delivery.state).toBe("idle");
			expect(delivery.input).toBe(null);
			expect(delivery.target).toBe(target);
		});
	});

	describe("deliver()", () => {
		it("transitions to pending and sets input", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			const input = makeInput();

			delivery.deliver(input);

			expect(delivery.state).toBe("pending");
			expect(delivery.input).toBe(input);
		});

		it("throws when called in pending state", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			delivery.deliver(makeInput());

			expect(() => delivery.deliver(makeInput())).toThrow();
		});

		it("throws when called in rendered state", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");
			pd!.setState("rendered");

			expect(() => delivery.deliver(makeInput())).toThrow();
		});

		it("throws when called in destroyed state", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			delivery.destroy();

			expect(() => delivery.deliver(makeInput())).toThrow();
		});
	});

	describe("use()", () => {
		it("calls plugin setup with PluginDelivery and AbortSignal", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			const setup = vi.fn(() => undefined);
			const plugin: DeliveryPlugin<string> = { name: "test", setup };

			delivery.use(plugin);

			expect(setup).toHaveBeenCalledOnce();
			const [pd, signal] = setup.mock.calls[0]!;
			expect(pd.setState).toBeTypeOf("function");
			expect(pd.emit).toBeTypeOf("function");
			expect(signal.aborted).toBe(false);
		});

		it("PluginDelivery does not expose deliver or use", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});

			expect("deliver" in pd!).toBe(false);
			expect("use" in pd!).toBe(false);
			expect(pd!.setState).toBeTypeOf("function");
			expect(pd!.emit).toBeTypeOf("function");
			expect(pd!.destroy).toBeTypeOf("function");
		});

		it("cleanup function is called on destroy", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			const cleanup = vi.fn();
			delivery.use({
				name: "test",
				setup() {
					return cleanup;
				},
			});

			delivery.destroy();

			expect(cleanup).toHaveBeenCalledOnce();
		});
	});

	describe("setState (via plugin)", () => {
		it("fires statechange event on valid transition", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());

			const handler = vi.fn();
			delivery.on("statechange", handler);
			pd!.setState("rendering");

			expect(handler).toHaveBeenCalledWith({
				from: "pending",
				to: "rendering",
			});
		});

		it("invalid transition logs warn and does not change state", () => {
			const logger = makeLogger();
			const delivery = createDelivery("target", { logger });

			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});

			pd!.setState("rendered"); // idle → rendered is invalid

			expect(logger.warn).toHaveBeenCalledOnce();
			expect(delivery.state).toBe("idle");
		});

		it("same-state transition is no-op (no event, no warn)", () => {
			const logger = makeLogger();
			const delivery = createDelivery("target", { logger });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());

			const handler = vi.fn();
			delivery.on("statechange", handler);
			pd!.setState("pending"); // already pending

			expect(handler).not.toHaveBeenCalled();
			expect(logger.warn).not.toHaveBeenCalled();
		});
	});

	describe("rendering timeout", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it("auto-transitions to error after default 5000ms", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");

			vi.advanceTimersByTime(5000);

			expect(delivery.state).toBe("error");
		});

		it("fires error event with source timeout", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");

			const handler = vi.fn();
			delivery.on("error", handler);
			vi.advanceTimersByTime(5000);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0]![0]).toMatchObject({
				source: "timeout",
			});
		});

		it("aborts signal on timeout", () => {
			let signal: AbortSignal | undefined;
			let pd: PluginDelivery<string> | undefined;
			const delivery = createDelivery("target", { logger: makeLogger() });
			delivery.use({
				name: "test",
				setup(d, s) {
					signal = s;
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");

			vi.advanceTimersByTime(5000);

			expect(signal!.aborted).toBe(true);
		});

		it("respects custom renderingTimeout", () => {
			const delivery = createDelivery("target", {
				logger: makeLogger(),
				renderingTimeout: 1000,
			});
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");

			vi.advanceTimersByTime(999);
			expect(delivery.state).toBe("rendering");

			vi.advanceTimersByTime(1);
			expect(delivery.state).toBe("error");
		});

		it("error handler sees state === error on timeout", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");

			let stateInErrorHandler: string | undefined;
			delivery.on("error", () => {
				stateInErrorHandler = delivery.state;
			});
			vi.advanceTimersByTime(5000);

			expect(stateInErrorHandler).toBe("error");
		});

		it("fires statechange before error event on timeout", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");

			const order: string[] = [];
			delivery.on("statechange", ({ to }) => {
				if (to === "error") order.push("statechange");
			});
			delivery.on("error", () => {
				order.push("error");
			});
			vi.advanceTimersByTime(5000);

			expect(order).toEqual(["statechange", "error"]);
		});

		it("clears timeout when rendered before expiry", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");
			pd!.setState("rendered");

			vi.advanceTimersByTime(10000);

			expect(delivery.state).toBe("rendered");
		});
	});

	describe("rendered triggers impression", () => {
		it("emits impression event on rendered transition", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");

			const handler = vi.fn();
			delivery.on("impression", handler);
			pd!.setState("rendered");

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0]![0].ts).toBeTypeOf("number");
		});
	});

	describe("destroy()", () => {
		it("transitions to destroyed", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			delivery.destroy();
			expect(delivery.state).toBe("destroyed");
		});

		it("calls all plugin cleanup functions", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			const c1 = vi.fn();
			const c2 = vi.fn();
			delivery.use({ name: "p1", setup: () => c1 });
			delivery.use({ name: "p2", setup: () => c2 });

			delivery.destroy();

			expect(c1).toHaveBeenCalledOnce();
			expect(c2).toHaveBeenCalledOnce();
		});

		it("emits destroy event", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			const handler = vi.fn();
			delivery.on("destroy", handler);

			delivery.destroy();

			expect(handler).toHaveBeenCalledOnce();
		});

		it("clears rendering timeout", () => {
			vi.useFakeTimers();
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");
			delivery.destroy();

			vi.advanceTimersByTime(10000);
			expect(delivery.state).toBe("destroyed");
			vi.useRealTimers();
		});

		it("aborts signal", () => {
			let signal: AbortSignal | undefined;
			const delivery = createDelivery("target", { logger: makeLogger() });
			delivery.use({
				name: "test",
				setup(_d, s) {
					signal = s;
					return undefined;
				},
			});

			delivery.destroy();

			expect(signal!.aborted).toBe(true);
		});
	});

	describe("viewable dedup (integration)", () => {
		it("viewable handler fires only once", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");
			pd!.setState("rendered");

			const handler = vi.fn();
			delivery.on("viewable", handler);
			pd!.emit("viewable", { ts: 1 });
			pd!.emit("viewable", { ts: 2 });

			expect(handler).toHaveBeenCalledOnce();
		});
	});

	describe("click multiple times", () => {
		it("click handler fires every time", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");
			pd!.setState("rendered");

			const handler = vi.fn();
			delivery.on("click", handler);
			pd!.emit("click", { ts: 1, url: "https://example.com" });
			pd!.emit("click", { ts: 2, url: "https://example.com" });
			pd!.emit("click", { ts: 3, url: "https://example.com" });

			expect(handler).toHaveBeenCalledTimes(3);
		});
	});

	describe("emit after destroy", () => {
		it("plugin emit is suppressed after destroy", () => {
			const delivery = createDelivery("target", { logger: makeLogger() });
			let pd: PluginDelivery<string> | undefined;
			delivery.use({
				name: "test",
				setup(d) {
					pd = d;
					return undefined;
				},
			});
			delivery.deliver(makeInput());
			pd!.setState("rendering");
			pd!.setState("rendered");

			const handler = vi.fn();
			delivery.on("viewable", handler);

			delivery.destroy();
			pd!.emit("viewable", { ts: 1 });

			expect(handler).not.toHaveBeenCalled();
		});
	});
});
