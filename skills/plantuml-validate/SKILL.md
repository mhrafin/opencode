---
name: plantuml-validate
description: Verify a PlantUML diagram actually renders without syntax errors. Use after creating or editing any .puml file, or when asked whether a PlantUML/C4 diagram is valid or renders. Covers the remote-render workflow used when no local plantuml binary exists.
---

# PlantUML Validate

Render the diagram and prove it draws. Never assume a `.puml` file is valid because it looks right.

## Step 1: Try local first

Check for a local renderer and use it if present:

```bash
which plantuml
```

If found: `plantuml -tsvg <file>` and check the exit code plus output for a rendered SVG. If not found (the common case on this machine), go remote.

## Step 2: Encode the diagram

No local plantuml → encode the source and render remotely. Working Python snippet (verified — replace `FILE` with the path to the `.puml` file):

```python
import zlib

def encode6bit(b):
    if b < 10: return chr(48 + b)
    b -= 10
    if b < 26: return chr(65 + b)
    b -= 26
    if b < 26: return chr(97 + b)
    b -= 26
    if b == 0: return '-'
    if b == 1: return '_'
    return '?'

def append3bytes(b1, b2, b3):
    c1 = b1 >> 2
    c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
    c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
    c4 = b3 & 0x3F
    return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4)

def encode6(data):
    res = ""
    for i in range(0, len(data), 3):
        b1 = data[i]
        b2 = data[i+1] if i+1 < len(data) else 0
        b3 = data[i+2] if i+2 < len(data) else 0
        res += append3bytes(b1, b2, b3)
    return res

src = open(FILE, 'rb').read()  # e.g. open('/path/to/01-c4.puml', 'rb').read()
print("http://www.plantuml.com/plantuml/svg/~1" + encode6(zlib.compress(src, 9)))
```

**Critical:** the resulting URL **must carry the `~1` prefix** between `/svg/` and the encoded payload. Without it the server returns HTTP 200 with an error image saying "bad URL ... HUFFMAN encoding".

## Step 3: Render in the browser (chrome-devtools MCP)

Direct HTTP fetching of render services fails from this environment — do not retry:

- `urllib`/`curl` to plantuml.com → **403 Forbidden**
- kroki.io → **400 "Unable to decode the source"** (even for trivial diagrams)

The working path is a real browser:

1. `list_pages` — record which pages already exist so cleanup only removes ours
2. `new_page({ url })` with the `~1`-encoded URL
3. `take_screenshot({ pageId, format: "png", filePath })` to a file under `/tmp/opencode/`
4. `read` the screenshot and **visually inspect it**

## Step 4: Success check is visual, never HTTP status

PlantUML returns **HTTP 200 even when the diagram has syntax errors** — the error text is drawn inside the SVG (a grey box with messages like "Syntax Error" or the "bad URL / HUFFMAN" notice).

- Pass: the expected diagram shapes/relationships render
- Fail: any grey error box, partial render, or missing elements → fix the `.puml`, re-encode, re-render

## Step 5: Mandatory cleanup

Always clean up, in this order:

1. Close every page **we opened** with `close_page` (never pages that existed before we started; the last open page cannot be closed)
2. Shut down the MCP-spawned Chrome process itself — the MCP has **no quit-browser tool**, so closing pages leaves Chrome running. Find and kill only the instance the MCP launched:

```bash
ps aux | grep -iE 'chrome|chromium' | grep -E 'remote-debugging-port|--user-data-dir=.*(devtools|chrome-mcp|tmp)' | grep -v grep
```

Kill only a PID that clearly matches the MCP spawn (debug port / temp profile flag). Never kill a user's regular browser.

3. If the process cannot be identified unambiguously, close your pages and **tell the user the browser is still open** instead of guessing at a PID.
