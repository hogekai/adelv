import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "../src/event-bus.js";

describe("createEventBus", () => {
	it("executes handlers synchronously in registration order", () => {
		const bus = createEventBus();
		const order: number[] = [];

		bus.on("statechange", () => order.push(1));
		bus.on("statechange", () => order.push(2));
		bus.on("statechange", () => order.push(3));

		bus.emit("statechange", { from: "idle", to: "pending" });

		expect(order).toEqual([1, 2, 3]);
	});

	it("does not call handler after off()", () => {
		const bus = createEventBus();
		const a = vi.fn();
		const b = vi.fn();

		bus.on("statechange", a);
		bus.on("statechange", b);
		bus.off("statechange", a);

		bus.emit("statechange", { from: "idle", to: "pending" });

		expect(a).not.toHaveBeenCalled();
		expect(b).toHaveBeenCalledOnce();
	});

	it("off() with unregistered handler is no-op", () => {
		const bus = createEventBus();
		expect(() => bus.off("statechange", () => {})).not.toThrow();
	});

	it("viewable fires only once (dedup guard)", () => {
		const bus = createEventBus();
		const handler = vi.fn();

		bus.on("viewable", handler);
		bus.emit("viewable", { ts: 1 });
		bus.emit("viewable", { ts: 2 });

		expect(handler).toHaveBeenCalledOnce();
		expect(handler).toHaveBeenCalledWith({ ts: 1 });
	});

	it("click fires multiple times", () => {
		const bus = createEventBus();
		const handler = vi.fn();

		bus.on("click", handler);
		bus.emit("click", { ts: 1, url: "https://example.com" });
		bus.emit("click", { ts: 2, url: "https://example.com" });
		bus.emit("click", { ts: 3, url: "https://example.com" });

		expect(handler).toHaveBeenCalledTimes(3);
	});

	it("events are independent of each other", () => {
		const bus = createEventBus();
		const scHandler = vi.fn();
		const impHandler = vi.fn();

		bus.on("statechange", scHandler);
		bus.on("impression", impHandler);

		bus.emit("statechange", { from: "idle", to: "pending" });

		expect(scHandler).toHaveBeenCalledOnce();
		expect(impHandler).not.toHaveBeenCalled();
	});

	it("emit with no handlers is no-op", () => {
		const bus = createEventBus();
		expect(() => bus.emit("impression", { ts: 1 })).not.toThrow();
	});
});
