import test from "node:test";
import assert from "node:assert/strict";
import { properCopy } from "../extensions/unwrap.ts";

// Simulated terminal: 40 columns. The transcript wraps at 38 cells (1 column
// of layout padding on each side), so a visually wrapped row is ~38 wide, and
// one that wrapped on a space can be several cells shorter.
const W = 40;
const CONTENT = 38;

/** Fill a line to the content width with `fill` characters. */
function edge(s: string, fill = "x"): string {
	const line = s + fill.repeat(Math.max(0, CONTENT - s.length));
	assert.equal(line.length, CONTENT);
	return line;
}
const pad = (s: string, n: number) => {
	const line = s + "x".repeat(Math.max(0, n - s.length));
	assert.equal(line.length, n);
	return line;
};

const opts = { width: W, fromColumnZero: false, startCol: 0 };

test("joins a full-width wrapped prose line", () => {
	const l0 = edge("This is a long sentence that reache");
	const out = properCopy(`${l0}\nthe edge of the terminal window.`, opts);
	assert.equal(out, `${l0} the edge of the terminal window.`);
});

test("joins a wrap that fell on a space (row visibly short of the edge)", () => {
	// This is the reported bug: the break happened at "same / paragraph",
	// leaving ~8 empty cells on the wrapped row.
	const l0 = edge("Fixed and pushed. Reload Pi once more");
	const l1 = pad("(the running session still has", 30);
	const out = properCopy(`${l0}\n${l1}\nparagraph and retest it now`, opts);
	// l1 ends at 30; next word "paragraph" (9): 30 + 1 + 9 > 38 -> was a wrap.
	assert.equal(out, `${l0} ${l1} paragraph and retest it now`);
});

test("keeps a hard newline where the next word would have fit", () => {
	const l0 = edge("The paragraph above wrapped fully");
	const l1 = pad("and ends right about he", 33);
	const out = properCopy(`${l0}\n${l1}\ntiny four words tail`, opts);
	// 33 + 1 + 4 (tiny) = 38 is NOT > 38: "tiny" would have fit -> real break.
	assert.equal(out, `${l0} ${l1}\ntiny four words tail`);
});

test("leaves a selection of only short lines untouched (width guard)", () => {
	const text = "First short line.\nSecond short line.";
	assert.equal(properCopy(text, opts), text);
});

test("leaves rows that never reach the screen edge untouched (scroll box)", () => {
	const box = pad("box output row that is 59 cells wide", 59);
	const text = `${box}\ncontinuation tail`;
	assert.equal(properCopy(text, { width: 100, fromColumnZero: false, startCol: 0 }), text);
});

test("keeps blank lines (paragraph breaks)", () => {
	const l0 = edge("Paragraph one wrapped across the li");
	const out = properCopy(`${l0}\nne\n\nParagraph two starts fresh.`, opts);
	assert.equal(out, `${l0} ne\n\nParagraph two starts fresh.`);
});

test("keeps list, heading, quote, fence and table boundaries", () => {
	const l0 = edge("Item text that wraps over the termina");
	const text = [
		l0,
		"l width and continues",
		"",
		"- a new list item",
		"## Heading after",
		"> a quote line",
		"```",
		"code inside fence",
		"```",
		"| a | table | row |",
	].join("\n");
	const out = properCopy(text, opts);
	assert.equal(
		out,
		`${l0} l width and continues\n\n- a new list item\n## Heading after\n> a quote line\n\`\`\`\ncode inside fence\n\`\`\`\n| a | table | row |`,
	);
});

test("joins wrapped list-item continuations", () => {
	const l0 = edge("- The first item is long and wraps t");
	const out = properCopy(`${l0}\no the next screen line`, opts);
	assert.equal(out, `${l0} o the next screen line`);
});

test("joins wrapped long URLs without spaces", () => {
	const l0 = edge("See https://example.com/very", "0");
	const out = properCopy(`${l0}\nlong/path/continued`, opts);
	assert.equal(out, `${l0}long/path/continued`);
});

test("joins hyphenated wraps without a space", () => {
	const l0 = pad("The quick brown fox jumps over the la", CONTENT - 1) + "-";
	assert.equal(l0.length, CONTENT);
	const out = properCopy(`${l0}\nzy dog and keeps going`, opts);
	assert.equal(out, `${l0}zy dog and keeps going`);
});

test("strips the shared gutter and still joins correctly", () => {
	const l0 = ` ${edge("Guttered line one that is fully wra")}`;
	// All rows carry the 1-space gutter; row 3 has 2 spaces of real indent.
	const text = [l0, " ne width and wraps again", "   code-ish second line"].join("\n");
	const out = properCopy(text, { width: W, fromColumnZero: true, startCol: 0 });
	assert.equal(out, `${edge("Guttered line one that is fully wra")} ne width and wraps again\n  code-ish second line`);
});

test("does not strip meaningful shared indentation", () => {
	const text = "    const a = 1;\n    const b = 2;";
	assert.equal(properCopy(text, { width: W, fromColumnZero: true, startCol: 0 }), text);
});

test("rescues a mid-line selection start with the startCol prefix", () => {
	// Selection started 25 columns into the first row: the fragment plus the
	// cut prefix shows the row was full, so its break is a wrap.
	const r0 = "rag of the first row"; // 20 + 25 = 45 true row width
	const r1 = pad("second row continues with padded tail text", 43);
	const r2 = "final fragment";
	const out = properCopy(`${r0}\n${r1}\n${r2}`, { width: W, fromColumnZero: false, startCol: 25 });
	// 45 + 1 + 6 > 45 -> wrap; 43 + 1 + 5 > 45 -> wrap.
	assert.equal(out, `${r0} ${r1} ${r2}`);
});

test("still joins when the screen width is unknown", () => {
	const l0 = edge("Full line here but it wrapped on t");
	const out = properCopy(`${l0}\no second row`, { width: 0, fromColumnZero: false, startCol: 0 });
	assert.equal(out, `${l0} o second row`);
});

test("handles a single line selection", () => {
	assert.equal(properCopy("just one line", opts), "just one line");
});
