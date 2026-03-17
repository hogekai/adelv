import type { DeliveryPlugin } from "@adelv/ortb3";

/**
 * MRC viewability measurement plugin using IntersectionObserver.
 *
 * Starts observing after `rendered`. Emits `viewable` when the target is
 * at least `threshold` visible for `duration` milliseconds continuously.
 *
 * @param opts.threshold - Intersection ratio required. Default: `0.5` (50%).
 * @param opts.duration - Continuous visibility time in ms. Default: `1000` (MRC standard).
 * @returns A `DeliveryPlugin<HTMLElement>` for viewability measurement.
 */
export function viewability(opts?: {
	threshold?: number;
	duration?: number;
}): DeliveryPlugin<HTMLElement> {
	const threshold = opts?.threshold ?? 0.5;
	const duration = opts?.duration ?? 1000;

	return {
		name: "viewability",
		setup(delivery, signal) {
			let observer: IntersectionObserver | null = null;
			let timerId: ReturnType<typeof setTimeout> | null = null;

			function clearTimer() {
				if (timerId !== null) {
					clearTimeout(timerId);
					timerId = null;
				}
			}

			delivery.on("statechange", ({ to }) => {
				if (to !== "rendered") return;

				observer = new IntersectionObserver(
					(entries) => {
						if (signal.aborted) {
							observer?.disconnect();
							return;
						}

						const entry = entries[entries.length - 1];
						if (!entry) return;

						if (entry.isIntersecting) {
							if (timerId === null) {
								timerId = setTimeout(() => {
									timerId = null;
									delivery.emit("viewable", { ts: Date.now() });
									observer?.disconnect();
								}, duration);
							}
						} else {
							clearTimer();
						}
					},
					{ threshold },
				);

				observer.observe(delivery.target);
			});

			return () => {
				clearTimer();
				observer?.disconnect();
			};
		},
	};
}
