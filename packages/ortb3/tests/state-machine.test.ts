import { describe, it, expect } from "vitest"
import { isValidTransition } from "../src/state-machine.js"
import type { DeliveryState } from "../src/types.js"

describe("isValidTransition", () => {
	describe("valid transitions", () => {
		const valid: [DeliveryState, DeliveryState][] = [
			["idle", "pending"],
			["idle", "destroyed"],
			["pending", "rendering"],
			["pending", "error"],
			["pending", "destroyed"],
			["rendering", "rendered"],
			["rendering", "error"],
			["rendering", "destroyed"],
			["rendered", "destroyed"],
			["error", "destroyed"],
		]

		for (const [from, to] of valid) {
			it(`${from} → ${to}`, () => {
				expect(isValidTransition(from, to)).toBe(true)
			})
		}
	})

	describe("invalid transitions", () => {
		const invalid: [DeliveryState, DeliveryState][] = [
			["idle", "rendering"],
			["idle", "rendered"],
			["idle", "error"],
			["pending", "rendered"],
			["pending", "idle"],
			["rendering", "pending"],
			["rendering", "idle"],
			["rendered", "idle"],
			["rendered", "pending"],
			["rendered", "rendering"],
			["rendered", "error"],
			["error", "idle"],
			["error", "pending"],
			["destroyed", "idle"],
			["destroyed", "pending"],
			["destroyed", "rendering"],
			["destroyed", "rendered"],
			["destroyed", "error"],
		]

		for (const [from, to] of invalid) {
			it(`${from} → ${to}`, () => {
				expect(isValidTransition(from, to)).toBe(false)
			})
		}
	})

	describe("same-state transitions", () => {
		const states: DeliveryState[] = [
			"idle",
			"pending",
			"rendering",
			"rendered",
			"error",
			"destroyed",
		]

		for (const state of states) {
			it(`${state} → ${state}`, () => {
				expect(isValidTransition(state, state)).toBe(false)
			})
		}
	})
})
