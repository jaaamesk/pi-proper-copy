import { appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TuiAltScreen } from "@earendil-works/pi-tui";
import { properCopy } from "./unwrap.ts";

const INSTALL_LOG = path.join(os.homedir(), ".pi", "agent", "pi-proper-copy.log");

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

	// One line per (re)install so a loaded extension is easy to verify:
	//   tail -1 ~/.pi/agent/pi-proper-copy.log
	try {
		appendFileSync(INSTALL_LOG, `${new Date().toISOString()} patched TuiAltScreen.getActiveSelectionText\n`);
	} catch {
		// logging is best-effort
	}

	const patched = function (this: AltScreenLike): string | undefined {
		const text = original.call(this);
		if (text === undefined) return text;
		try {
			const bounds = this.getSelectionBounds?.();
		const width = this.previousScreenWidth ?? this.terminal?.columns ?? 0;
			return properCopy(text, {
				width,
				fromColumnZero: bounds ? bounds.start.col === 0 : false,
				// Selections that begin mid-line are only a fragment of that row;
				// adding the cut-off prefix restores its true rendered width.
				startCol: bounds?.start.col ?? 0,
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
