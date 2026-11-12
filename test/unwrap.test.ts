import test from "node:test";
import assert from "node:assert/strict";
import { properCopy } from "../extensions/unwrap.ts";

// Simulated terminal: 40 columns, transcript content area is width - 2 = 38
// cells (1 column of padding on each side). A wrapped line is 38 cells wide
// after trimming, or 37 when the wrap fell on a space.
const W = 40;
const CONTENT = W - 2;

/** Extend a line with filler so it exactly fills the content width. */
function edge(s: string): string {
	const line = s + "x".repeat(Math.max(0, CONTENT - s.length));
	assert.equal(line.length, CONTENT);
	return line;
}

const toEdge = { width: W, fromColumnZero: false, edgeReached: true };

test("joins a wrapped prose paragraph", () => {
	const l1 = edge("This is a long sentence that reaches");
	const out = properCopy(`${l1}\nthe edge of the terminal window.`, toEdge);
	assert.equal(out, `${l1} the edge of the terminal window.`);
});

test("keeps real newlines on short lines", () => {
	const text = "First short line.\nSecond short line.";
	assert.equal(properCopy(text, toEdge), text);
});

test("joins a wrap that fell on a space (one cell short of the longest line)", () => {
	const l1 = edge("The line that ended on a");
	const l2 = ("The wrap fell right on a space" + "x".repeat(20)).slice(0, CONTENT - 1); // CONTENT - 1
	assert.equal(l2.length, CONTENT - 1);
	assert.equal(properCopy(`${l1}\n${l2}\nand one more fragment.`, toEdge), `${l1} ${l2} and one more fragment.`);
});

test("keeps blank lines (paragraph breaks)", () => {
	const l1 = edge("Paragraph one wrapped across the line");
	const out = properCopy(`${l1}\nedge\n\nParagraph two starts fresh.`, toEdge);
	assert.equal(out, `${l1} edge\n\nParagraph two starts fresh.`);
});

test("keeps list, heading, quote, fence and table boundaries", () => {
	const l1 = edge("Item text that wraps over the terminal");
	const text = [
		l1,
		"width and continues here",
		"",
		"- a new list item",
		"## Heading after",
		"> a quote line",
		"```",
		"code inside fence",
		"```",
		"| a | table | row |",
	].join("\n");
	const out = properCopy(text, toEdge);
	assert.equal(
		out,
		`${l1} width and continues here\n\n- a new list item\n## Heading after\n> a quote line\n\`\`\`\ncode inside fence\n\`\`\`\n| a | table | row |`,
	);
});

test("joins wrapped list-item continuations", () => {
	// The item line is full-width, so its break is a wrap even though the
	// item starts with a marker.
	const l1 = edge("- The first item is long and wraps on");
	const out = properCopy(`${l1}\nthe next screen line`, toEdge);
	assert.equal(out, `${l1} the next screen line`);
});

test("joins wrapped long URLs without spaces", () => {
	const l1 = edge("See https://example.com/very");
	const out = properCopy(`${l1}\nlong/path/continued/here`, toEdge);
	assert.equal(out, `${l1}long/path/continued/here`);
});

test("keeps a space between normal words at the wrap point", () => {
	const l1 = edge("The quick brown fox jumps over");
	const out = properCopy(`${l1}\nthe lazy dog indeed`, toEdge);
	assert.equal(out, `${l1} the lazy dog indeed`);
});

test("joins hyphenated wraps without a space", () => {
	const l1 = "The quick brown fox jumps over the la".padEnd(CONTENT - 1, "z") + "-"; // CONTENT wide, ends in "-"
	assert.equal(l1.length, CONTENT);
	const out = properCopy(`${l1}\nzy dog and keeps wrapping`, toEdge);
	assert.equal(out, `${l1}zy dog and keeps wrapping`);
});

test("leaves selections away from the right edge untouched", () => {
	const l1 = edge("A full width line in a narrow");
	const text = `${l1.slice(0, 20)}\n${l1.slice(0, 20)}`; // 20-cell slices, no edge
	const out = properCopy(text, { width: W, fromColumnZero: false, edgeReached: false });
	assert.equal(out, text);
});

test("keeps a lone long line that cannot be a wrap context", () => {
	// Longest line is only ~60% of the content width: plausibly a real long
	// line in a narrow area, so nothing is joined.
	const l1 = "A".repeat(Math.floor(CONTENT * 0.85));
	const text = `${l1}\nnext line`;
	assert.equal(properCopy(text, toEdge), text);
});

test("strips the shared gutter when the selection starts at column 0", () => {
	const l0 = edge("Guttered line one that is full");
	// Every line carries the 1-space screen gutter; the last line has 2 more (real indent).
	const text = [` ${l0}`, " width and wraps again", "   code-ish second line"].join("\n");
	const out = properCopy(text, { width: W, fromColumnZero: true, edgeReached: true });
	assert.equal(out, `${l0} width and wraps again\n  code-ish second line`);
});

test("does not strip meaningful shared indentation", () => {
	const text = "    const a = 1;\n    const b = 2;";
	assert.equal(properCopy(text, { width: W, fromColumnZero: true, edgeReached: true }), text);
});

test("is a no-op when the screen width is unknown", () => {
	const l1 = edge("Full line here");
	const text = `${l1}\nsecond line`;
	assert.equal(properCopy(text, { width: 0, fromColumnZero: false, edgeReached: true }), text);
});

test("handles a single line selection", () => {
	assert.equal(properCopy("just one line", toEdge), "just one line");
});
