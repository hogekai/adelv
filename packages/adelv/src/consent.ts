import { type BeaconSender, defaultSendBeacon } from "./tracking.js";

/**
 * Wrap a beacon sender with consent checking.
 *
 * When `getConsent()` returns `false`, the beacon is not fired
 * and an error is thrown. The core catches this and emits an
 * `error` event with `source: "tracking"`, preserving the
 * consent rejection in the error message for logging.
 *
 * @param getConsent - Function that returns `true` if consent is granted.
 *   Called synchronously before each beacon fire.
 *   Typical implementations read from a CMP (TCF `__tcfapi`, CCPA `__uspapi`, etc.).
 * @param sender - Underlying beacon sender. Default: `defaultSendBeacon` (fetch GET).
 * @returns A `BeaconSender` that checks consent before firing.
 *
 * @example
 * ```typescript
 * import { createDelivery, withConsent } from "@adelv/adelv"
 *
 * const delivery = createDelivery(element, {
 *   sendBeacon: withConsent(() => {
 *     return window.__tcfapiConsentGranted === true
 *   }),
 * })
 * ```
 */
export function withConsent(
	getConsent: () => boolean,
	sender?: BeaconSender,
): BeaconSender {
	const send = sender ?? defaultSendBeacon;
	return async (url: string): Promise<void> => {
		if (!getConsent()) {
			throw new Error(`Consent not granted: ${url}`);
		}
		await send(url);
	};
}
