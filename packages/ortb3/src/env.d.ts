// AbortSignal is available in all modern runtimes (Node, Deno, browsers)
// but TypeScript only includes it in DOM lib.
// Declare minimally to keep core environment-agnostic (no DOM lib).
interface AbortSignal {
	readonly aborted: boolean
	readonly reason: unknown
	addEventListener(type: "abort", listener: () => void): void
	removeEventListener(type: "abort", listener: () => void): void
}
