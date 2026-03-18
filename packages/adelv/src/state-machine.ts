import { type DeliveryState, TRANSITIONS } from "./types.js";

export function isValidTransition(
	from: DeliveryState,
	to: DeliveryState,
): boolean {
	return TRANSITIONS[from].includes(to);
}
