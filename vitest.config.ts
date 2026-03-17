import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: false,
		passWithNoTests: true,
		projects: [
			{
				test: {
					name: "ortb3",
					include: ["packages/ortb3/tests/**/*.test.ts"],
					environment: "node",
				},
			},
			{
				test: {
					name: "ortb3-web",
					include: ["packages/ortb3-web/tests/**/*.test.ts"],
					environment: "happy-dom",
				},
			},
		],
	},
})
