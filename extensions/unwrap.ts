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
	/** Screen column where the selection starts (mid-line starts cut the first row). */
	startCol: number;
}

/**
 * Rebuild selection text with visual (soft) wraps removed.
 *
 * The decision uses the renderer's own rule: a row was visually wrapped
 * exactly when the first word of the next row did not fit on it, i.e.
 * `lineWidth + 1 + firstWordWidth > wrapWidth`. A break where the next word
 * would have fit is a real source newline and is kept. The wrap width is
 * measured from the widest selected row (every row except the selection's
 * last one, which is always a fragment), so it adapts to padding, resizes,
 * and per-user layout settings.
 *
 * Widths are only trusted when some row reaches (near) the screen edge:
 * otherwise they may come from a horizontal slice or from a narrow scroll box
 * whose inner width cannot be observed, and joining would be guessing.
 */
export function properCopy(
	text: string,
	{ width, fromColumnZero, startCol }: UnwrapOptions,
): string {
	let lines = text.split("\n").map((line) => line.trimEnd());
	if (lines.length < 2) return lines.join("\n");

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

	const widths = lines.map((line) => visibleWidth(line));
	// A selection starting mid-line cuts the prefix off the first row, so the
	// fragment underestimates that row's true rendered width.
	if (widths[0] !== undefined) widths[0] += Math.max(0, startCol);
	let wrapWidth = 0;
	for (let i = 0; i < lines.length - 1; i++) wrapWidth = Math.max(wrapWidth, widths[i] ?? 0);

	if (wrapWidth < 20) return lines.join("\n");
	// Require a row near the screen edge so rows in a narrow scroll box (whose
	// inner width cannot be observed here) are never joined.
	if (width >= 12 && wrapWidth < width - 12) return lines.join("\n");

	const out: string[] = [lines[0] ?? ""];
	for (let i = 1; i < lines.length; i++) {
		const left = lines[i - 1] ?? "";
		const right = lines[i] ?? "";
		let joined = false;
		if (left.trim() !== "" && right.trim() !== "" && !STRUCTURAL_START.test(right)) {
			const firstWord = (right.trimStart().match(/^\S+/)?.[0] ?? "").length || 1;
			joined = (widths[i - 1] ?? 0) + 1 + firstWord > wrapWidth;
		}
		if (joined) {
			out[out.length - 1] = `${out[out.length - 1]}${joinerFor(left, right)}${right.trimStart()}`;
		} else {
			out.push(right);
		}
	}
	return out.join("\n");
}
