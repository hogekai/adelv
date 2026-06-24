import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Resolve workspace packages to their source during tests so cross-package
// tests (web/gpt → adelv) always exercise current source, not a stale dist build.
const alias = {
	"@adelv/adelv": fileURLToPath(
		new URL("./packages/adelv/src/index.ts", import.meta.url),
	),
}

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
				resolve: { alias },
				test: {
					name: "web",
					include: ["packages/web/tests/**/*.test.ts"],
					environment: "happy-dom",
				},
			},
			{
				resolve: { alias },
				test: {
					name: "gpt",
					include: ["packages/gpt/tests/**/*.test.ts"],
					environment: "happy-dom",
				},
			},
		],
	},
})
