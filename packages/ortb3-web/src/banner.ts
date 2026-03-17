import type { DeliveryPlugin } from "@adelv/ortb3";

export function banner(): DeliveryPlugin<HTMLElement> {
	return {
		name: "banner",
		setup(delivery, signal) {
			delivery.on("statechange", ({ to }) => {
				if (to !== "pending") return;

				const display = delivery.input?.ad.display;
				if (!display) return;

				delivery.setState("rendering");

				if (!display.adm) {
					delivery.setState("error");
					return;
				}

				const iframe = document.createElement("iframe");
				iframe.srcdoc = display.adm;
				iframe.sandbox.add(
					"allow-scripts",
					"allow-popups",
					"allow-popups-to-escape-sandbox",
				);
				iframe.style.border = "none";
				if (display.w != null) iframe.width = String(display.w);
				if (display.h != null) iframe.height = String(display.h);

				iframe.onload = () => {
					if (signal.aborted) return;
					delivery.setState("rendered");
				};

				delivery.target.appendChild(iframe);
			});

			return () => {
				delivery.target.innerHTML = "";
			};
		},
	};
}
