import type { DeliveryPlugin } from "@adelv/ortb3";

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
