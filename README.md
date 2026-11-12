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

It uses a geometric fact: a rendered line can only have been visually wrapped
if it was filled to the right edge of the content area. The content area is
narrower than the terminal (layout padding), so instead of assuming a width,
it measures it: when a selection reaches the right edge, the longest line in
the selection *is* a full line, and any line within one cell of it (a wrap
that fell on a space) was a visual wrap too. Everything else kept its real
newline and is untouched. The screen width (`previousScreenWidth`, which Pi
updates on every render, including resizes) is only used to verify that the
selection actually reached the right edge and that the lines are plausibly
full-width — so terminal resizing works without any reconfiguration.

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
- Applies to the main transcript. Selections inside nested scroll boxes
  (e.g. expanded tool output) keep their wraps.
- Uses a Pi-internal method (`TuiAltScreen.getActiveSelectionText`), so a
  future Pi version that renames it needs a compatibility update. If that
  ever happens, copying simply degrades to today's behavior — it cannot break
  copying.

## Development

```bash
npm install
npm test
```
