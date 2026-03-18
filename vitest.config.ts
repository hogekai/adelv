import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: false,
		passWithNoTests: true,
		projects: [
			{
				test: {
					name: "adelv",
					include: ["packages/adelv/tests/**/*.test.ts"],
					environment: "node",
				},
			},
			{
				test: {
					name: "web",
					include: ["packages/web/tests/**/*.test.ts"],
					environment: "happy-dom",
				},
			},
			{
				test: {
					name: "gpt",
					include: ["packages/gpt/tests/**/*.test.ts"],
					environment: "happy-dom",
				},
			},
		],
	},
})
