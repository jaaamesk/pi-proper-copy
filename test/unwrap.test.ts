import test from "node:test";
import assert from "node:assert/strict";
import { properCopy } from "../extensions/unwrap.ts";

// Simulated terminal: 40 columns. A content line that hit the right edge is
// W-1 cells wide after trimming (or W-2 when the wrap fell on a space, which
// is ambiguous and deliberately kept as a break).
const W = 40;

/** Extend a line with filler so it exactly fills the content width (W-1). */
function edge(s: string): string {
	const line = s + "x".repeat(Math.max(0, W - 1 - s.length));
	assert.equal(line.length, W - 1);
	return line;
}

test("joins a wrapped prose paragraph", () => {
	const l1 = edge("This is a long sentence that reaches");
	const out = properCopy(`${l1}\nthe edge of the terminal window.`, { width: W, fromColumnZero: false });
	assert.equal(out, `${l1} the edge of the terminal window.`);
});

test("keeps real newlines on short lines", () => {
	const text = "First short line.\nSecond short line.";
	assert.equal(properCopy(text, { width: W, fromColumnZero: false }), text);
});

test("keeps a break on a line one cell short of the edge (ambiguous)", () => {
	const line = "A".repeat(W - 2);
	const text = `${line}\nnext line`;
	assert.equal(properCopy(text, { width: W, fromColumnZero: false }), text);
});

test("keeps blank lines (paragraph breaks)", () => {
	const l1 = edge("Paragraph one wrapped across the line");
	const out = properCopy(`${l1}\nedge\n\nParagraph two starts fresh.`, { width: W, fromColumnZero: false });
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
	const out = properCopy(text, { width: W, fromColumnZero: false });
	assert.equal(
		out,
		`${l1} width and continues here\n\n- a new list item\n## Heading after\n> a quote line\n\`\`\`\ncode inside fence\n\`\`\`\n| a | table | row |`,
	);
});

test("joins wrapped list-item continuations", () => {
	// The item line is full-width, so its break is a wrap even though the
	// item starts with a marker.
	const l1 = "- The first item is long and wraps onto"; // exactly W-1
	assert.equal(l1.length, W - 1);
	const out = properCopy(`${l1}\nthe next screen line`, { width: W, fromColumnZero: false });
	assert.equal(out, `${l1} the next screen line`);
});

test("joins wrapped long URLs without spaces", () => {
	const l1 = edge("See https://example.com/very");
	const out = properCopy(`${l1}\nlong/path/continued/here`, { width: W, fromColumnZero: false });
	assert.equal(out, `${l1}long/path/continued/here`);
});

test("keeps a space between normal words at the wrap point", () => {
	const l1 = edge("The quick brown fox jumps over");
	const out = properCopy(`${l1}\nthe lazy dog indeed`, { width: W, fromColumnZero: false });
	assert.equal(out, `${l1} the lazy dog indeed`);
});

test("joins hyphenated wraps without a space", () => {
	const l1 = "The quick brown fox jumps over the la".padEnd(W - 2, "z") + "-"; // W-1 wide, ends in "-"
	assert.equal(l1.length, W - 1);
	const out = properCopy(`${l1}\nzy dog and keeps wrapping`, { width: W, fromColumnZero: false });
	assert.equal(out, `${l1}zy dog and keeps wrapping`);
});

test("strips the shared gutter when the selection starts at column 0", () => {
	const l0 = edge("Guttered line one that is full");
	// Every line carries the 1-space screen gutter; the last line has 2 more (real indent).
	const text = [` ${l0}`, " width and wraps again", "   code-ish second line"].join("\n");
	const out = properCopy(text, { width: W, fromColumnZero: true });
	assert.equal(out, `${l0} width and wraps again\n  code-ish second line`);
});

test("does not strip meaningful shared indentation", () => {
	const text = "    const a = 1;\n    const b = 2;";
	assert.equal(properCopy(text, { width: W, fromColumnZero: true }), text);
});

test("is a no-op when the screen width is unknown", () => {
	const l1 = edge("Full line here");
	const text = `${l1}\nsecond line`;
	assert.equal(properCopy(text, { width: 0, fromColumnZero: false }), text);
});

test("handles a single line selection", () => {
	assert.equal(properCopy("just one line", { width: W, fromColumnZero: false }), "just one line");
});
