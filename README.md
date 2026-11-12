# pi-proper-copy

Copy *text*, not terminal geometry.

Pi renders long lines with soft wraps to fit the terminal. When you copy a
mouse selection from the fullscreen TUI, those visual wraps become real
newlines in your clipboard, so pasting elsewhere produces broken lines.

`pi-proper-copy` intercepts the selection text right before it is copied and
removes the wraps that were only ever visual.

## How it works

In fullscreen mode Pi owns text selection: copies go through
`TuiAltScreen.getActiveSelectionText()`. This extension wraps that method and
normalizes the result — no Pi files are modified, and the original session
content is never touched. Only the text that reaches the clipboard changes.

It uses the renderer's own wrapping rule. A row was visually wrapped exactly
when the first word of the next row **did not fit** on it:
`rowWidth + 1 + firstWordWidth > wrapWidth`. A break where the next word
would have fit is a real source newline and is kept. The wrap width is
measured from the widest row in the selection itself (never hard-coded), so
it adapts to padding, resizes, and layout settings automatically. Selections
that start mid-line are compensated by adding the cut-off prefix back.

Joining is done carefully:

- prose wraps join with a space,
- hyphenated wraps (`well-` / `known`) and mid-URL/mid-path wraps join with
  none,
- structural lines (headings, list items, block quotes, code fences, tables,
  horizontal rules) always keep their break,
- the 1-2 column layout gutter is stripped when the selection starts at
  column 0.

## Install

```bash
# from a clone of this repo
echo "/path/to/pi-proper-copy" >> ~/.pi/agent/settings.json # add to "packages"
```

or, once published: `pi install npm:pi-proper-copy`.

Restart Pi, then select and copy as usual.

## Requirements & limitations

- **Fullscreen mode** (the Pi default). In regular mode the *terminal* owns
  mouse selections and no Pi extension can see them.
- Selections inside narrow nested scroll boxes (e.g. expanded tool output)
  are passed through unchanged when no row reaches near the screen edge,
  since the box's inner width cannot be measured reliably.
- An intentional hard line break inside prose directly before a long word
  can still be joined (it is indistinguishable from a wrap) — the same
  ambiguity every soft-wrap copy tool has.
- Uses a Pi-internal method (`TuiAltScreen.getActiveSelectionText`), so a
  future Pi version that renames it needs a compatibility update. If that
  ever happens, copying simply degrades to today's behavior — it cannot break
  copying. A one-line record is appended to `~/.pi/agent/pi-proper-copy.log`
  on each load, so `tail -1 ~/.pi/agent/pi-proper-copy.log` verifies the
  extension is active.

## Development

```bash
npm install
npm test
```
