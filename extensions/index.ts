import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TuiAltScreen } from "@earendil-works/pi-tui";
import { properCopy } from "./unwrap.ts";

/** Minimal structural view of the alt-screen instance the patch needs. */
interface AltScreenLike {
	getActiveSelectionText?: () => string | undefined;
	getSelectionBounds?: () => { start: { col: number }; end: { col: number } } | undefined;
	previousScreenWidth?: number;
	terminal?: { columns?: number };
}

function installSelectionFix(): () => void {
	const proto = TuiAltScreen.prototype as unknown as AltScreenLike;
	const original = proto.getActiveSelectionText;
	if (typeof original !== "function") return () => {};

	const patched = function (this: AltScreenLike): string | undefined {
		const text = original.call(this);
		if (text === undefined) return text;
		try {
			const bounds = this.getSelectionBounds?.();
			const width = this.previousScreenWidth ?? this.terminal?.columns ?? 0;
			return properCopy(text, {
				width,
				fromColumnZero: bounds ? bounds.start.col === 0 : false,
				// The selection ends within 2 columns of the screen edge (allowing
				// for boundary semantics and a scrollbar column).
				edgeReached: width > 0 && bounds ? bounds.end.col >= width - 2 : false,
			});
		} catch {
			// Never break a copy over a normalization error.
			return text;
		}
	};

	proto.getActiveSelectionText = patched;
	return () => {
		if (proto.getActiveSelectionText === patched) proto.getActiveSelectionText = original;
	};
}

export default function properCopyExtension(pi: ExtensionAPI) {
	let restore: (() => void) | undefined;

	pi.on("session_start", (_event, ctx) => {
		restore?.();
		restore = undefined;
		if (ctx.mode !== "tui") return;
		restore = installSelectionFix();
	});

	pi.on("session_shutdown", () => {
		restore?.();
		restore = undefined;
	});
}
