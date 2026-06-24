import type { DeliveryPlugin, ViewableStandard } from "@adelv/adelv";

/** Intersection ratio + continuous-visibility duration (ms) defining each MRC standard. */
const STANDARD_CRITERIA: Record<
	ViewableStandard,
	{ ratio: number; duration: number }
> = {
	mrc50: { ratio: 0.5, duration: 1000 },
	mrc100: { ratio: 1.0, duration: 1000 },
	video50: { ratio: 0.5, duration: 2000 },
};

/**
 * MRC viewability measurement plugin using IntersectionObserver.
 *
 * Starts observing after `rendered`. For each requested `standard`, emits a
 * `viewable` event (carrying that standard) once the target stays at least
 * the standard's pixel ratio visible for its continuous duration.
 *
 * Standards (per AdCOM `EventType`):
 * - `mrc50` — 50% for 1s continuous (default).
 * - `mrc100` — 100% for 1s continuous.
 * - `video50` — 50% for 2s continuous.
 *
 * @param opts.standards - Standards to measure. Default: `["mrc50"]`.
 * @returns A `DeliveryPlugin<HTMLElement>` for viewability measurement.
 */
export function viewability(opts?: {
	standards?: ViewableStandard[];
}): DeliveryPlugin<HTMLElement> {
	const standards = opts?.standards ?? ["mrc50"];
	// Concrete entries (avoids index-by-key access under noUncheckedIndexedAccess).
	const criteria = (
		Object.entries(STANDARD_CRITERIA) as [
			ViewableStandard,
			{ ratio: number; duration: number },
		][]
	).filter(([s]) => standards.includes(s));

	return {
		name: "viewability",
		setup(delivery, signal) {
			let observer: IntersectionObserver | null = null;
			const timers = new Map<ViewableStandard, ReturnType<typeof setTimeout>>();
			const pending = new Set<ViewableStandard>(standards);

			function clearTimer(standard: ViewableStandard) {
				const id = timers.get(standard);
				if (id !== undefined) {
					clearTimeout(id);
					timers.delete(standard);
				}
			}

			function clearAllTimers() {
				for (const id of timers.values()) clearTimeout(id);
				timers.clear();
			}

			delivery.on("statechange", ({ to }) => {
				if (to !== "rendered") return;
				if (pending.size === 0) return;

				// One observer with every distinct ratio; each callback re-evaluates
				// all pending standards against the current intersection ratio.
				const thresholds = [...new Set(criteria.map(([, c]) => c.ratio))];

				observer = new IntersectionObserver(
					(entries) => {
						if (signal.aborted) {
							observer?.disconnect();
							return;
						}

						const entry = entries[0];
						if (!entry) return;

						for (const [standard, { ratio, duration }] of criteria) {
							if (!pending.has(standard)) continue;
							const meets =
								entry.isIntersecting && entry.intersectionRatio >= ratio;

							if (meets) {
								if (!timers.has(standard)) {
									timers.set(
										standard,
										setTimeout(() => {
											timers.delete(standard);
											pending.delete(standard);
											delivery.emit("viewable", { ts: Date.now(), standard });
											if (pending.size === 0) observer?.disconnect();
										}, duration),
									);
								}
							} else {
								clearTimer(standard);
							}
						}
					},
					{ threshold: thresholds },
				);

				observer.observe(delivery.target);
			});

			return () => {
				clearAllTimers();
				observer?.disconnect();
			};
		},
	};
}
