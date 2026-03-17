// Ambient declarations for APIs available in all modern runtimes
// (Node, Deno, browsers) but only included in TypeScript's DOM lib.
// Declared minimally to keep core environment-agnostic.

interface AbortSignal {
	readonly aborted: boolean;
	readonly reason: unknown;
	addEventListener(type: "abort", listener: () => void): void;
	removeEventListener(type: "abort", listener: () => void): void;
}

declare class AbortController {
	readonly signal: AbortSignal;
	abort(reason?: unknown): void;
}

declare function setTimeout(
	callback: () => void,
	ms?: number,
): ReturnType<typeof globalThis.setTimeout>;
declare function clearTimeout(id: ReturnType<typeof setTimeout> | null): void;

declare const console: {
	warn(...args: unknown[]): void;
};

declare function fetch(
	input: string,
	init?: { method?: string; keepalive?: boolean },
): Promise<Response>;

interface Response {
	readonly ok: boolean;
	readonly status: number;
}
