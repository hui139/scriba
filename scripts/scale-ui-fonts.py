"""
Rewrites hardcoded interface font sizes to scale with --ui-scale.

Every `font-size: <n>px` in the interface stylesheets becomes
`font-size: calc(<n>px * var(--ui-scale))`, so one variable in Settings changes the whole
UI. The document text is deliberately left alone: it is sized by --editor-font-size and
has its own slider.

Idempotent: lines already containing `--ui-scale` are skipped, so running it twice is safe.

Run:  python scripts/scale-ui-fonts.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES = os.path.join(ROOT, "src", "renderer", "src", "styles")

# Only the sheet that styles the editor content itself is excluded; the rest of that file
# (line numbers, find bar, widget chrome) is interface and should scale.
FILES = ["global.css", "settings.css", "editor.css"]

SIZE_RE = re.compile(r"font-size:\s*([0-9]+(?:\.[0-9]+)?)px")


def convert(path: str) -> tuple[int, int]:
    with open(path, encoding="utf-8") as fh:
        lines = fh.readlines()

    changed = 0
    for index, line in enumerate(lines):
        if "--ui-scale" in line:
            continue
        if not SIZE_RE.search(line):
            continue
        new_line = SIZE_RE.sub(
            lambda m: f"font-size: calc({m.group(1)}px * var(--ui-scale))", line
        )
        if new_line != line:
            lines[index] = new_line
            changed += 1

    if changed:
        with open(path, "w", encoding="utf-8") as fh:
            fh.writelines(lines)
    return changed, len(lines)


def main() -> None:
    total = 0
    for name in FILES:
        path = os.path.join(STYLES, name)
        if not os.path.exists(path):
            print(f"skip {name} (missing)")
            continue
        changed, lines = convert(path)
        total += changed
        print(f"{name}: {changed} of {lines} lines scaled")
    print(f"total: {total}")


if __name__ == "__main__":
    main()
