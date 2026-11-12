import { visibleWidth } from "@earendil-works/pi-tui";

/**
 * Lines that start a structural unit. A newline before such a line is almost
 * never a visual wrap, so it is always preserved.
 */
const STRUCTURAL_START =
	/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|~~~|\||([-=_]){3,}\s*$)/;

/** A token that looks like the start of a URL. */
const URL_HEAD = /^(?:https?:\/\/|www\.)/i;

/** Line ends with a character typical of URLs, file paths, or hyphenation. */
const TOKEN_BREAK = /[:/._?&=#%+~-]$/;

const TOKEN_CHAR = /^[\w/._?&=#%+~-]/;

function joinerFor(left: string, right: string): string {
	const tail = left.trimEnd();
	const head = right.trimStart();
	const lastToken = tail.match(/\S+$/)?.[0] ?? "";
	// Hyphenated break ("well-\nknown") or mid-token break (long URL, path).
	if (tail.endsWith("-")) return "";
	if (TOKEN_BREAK.test(tail) && TOKEN_CHAR.test(head)) return "";
	if (URL_HEAD.test(lastToken) && TOKEN_CHAR.test(head)) return "";
	return " ";
}

export interface UnwrapOptions {
	/** Screen width of the last rendered frame (TuiAltScreen.previousScreenWidth). */
	width: number;
	/** Whether the selection includes screen column 0 (and thus the layout gutter). */
	fromColumnZero: boolean;
	/** Whether the selection reaches the right edge of the screen. */
	edgeReached: boolean;
}

/**
 * Rebuild selection text with visual (soft) wraps removed.
 *
 * The transcript content area is narrower than the screen (left/right
 * padding, scrollbars), so the width of a filled line is measured from the
 * selection itself instead of the terminal: when the selection reaches the
 * right edge, the longest selected line is a full-width line, and any line
 * within one cell of it (a wrap that fell on a space) was also a visual wrap.
 * Shorter lines kept real newlines and stay untouched. Structural lines
 * (headings, lists, fences, quotes, tables, rules) always keep their break.
 *
 * Selections that do not reach the right edge are left as-is: their line
 * widths are slices, not true line widths, so nothing can be trusted.
 */
export function properCopy(text: string, { width, fromColumnZero, edgeReached }: UnwrapOptions): string {
	let lines = text.split("\n").map((line) => line.trimEnd());

	// The transcript is rendered with a small left gutter. When the selection
	// starts at column 0 every non-blank line carries it, so drop the shared
	// prefix (1-2 spaces). Deeper shared indentation is real (code) and stays.
	if (fromColumnZero) {
		const indents = lines
			.filter((line) => line.trim() !== "")
			.map((line) => line.length - line.trimStart().length);
		if (indents.length > 0) {
			const common = Math.min(...indents);
			if (common >= 1 && common <= 2) lines = lines.map((line) => line.slice(common));
		}
	}

	if (!Number.isFinite(width) || width < 10) return lines.join("\n");

	const widths = lines.map((line) => visibleWidth(line));
	const maxWidth = Math.max(0, ...widths);
	const contentWidth = width - 2;
	// Only trust measured widths when the selection spans to the right edge and
	// the longest line is plausibly a filled content line (not a narrow slice).
	if (!edgeReached || maxWidth < contentWidth * 0.9) return lines.join("\n");

	const fullAt = maxWidth - 1;
	const out: string[] = [lines[0] ?? ""];
	for (let i = 1; i < lines.length; i++) {
		const left = lines[i - 1];
		const right = lines[i];
		const isWrap =
			left.trim() !== "" &&
			right.trim() !== "" &&
			!STRUCTURAL_START.test(right) &&
			widths[i - 1] >= fullAt;
		if (isWrap) {
			out[out.length - 1] += joinerFor(left, right) + right.trimStart();
		} else {
			out.push(right);
		}
	}
	return out.join("\n");
}
