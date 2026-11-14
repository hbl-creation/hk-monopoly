#!/usr/bin/env python3
"""Build the chapter-1 playable demo page: prototypes/<key>-ch1.html

    python3 scripts/build_ch1.py [yuenlong]

The map itself is NOT regenerated here. The data blob (plots, roads, buildings, Herbert's baked-in edits and
their build stamp) is copied byte-for-byte out of prototypes/<key>-monopoly.html, so both pages always show the
same map and share the same in-browser editor edits. Sources:
  scripts/ch1-shell.html         page shell: CSS + HUD / sheets / modals
  scripts/<key>-template.html    map drawing code (everything between `const M=__DATA__;` and `// game`)
  scripts/ch1-game.js            chapter-1 game layer (rules, rivals, events, UI)
  scripts/editor.js              map editor (same injection as build_html.py)
build_html.py calls this at the end, so a map rebuild refreshes the demo page too.
"""
import os, sys, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key = sys.argv[1] if len(sys.argv) > 1 else 'yuenlong'
rd = lambda p: open(f'{ROOT}/{p}', encoding='utf-8').read()

page = rd(f'prototypes/{key}-monopoly.html')
a = page.index('const M=') + len('const M=')
b = page.index(';preEdits(M);', a)
blob = page[a:b]                                  # verbatim map data

tpl = rd(f'scripts/{key}-template.html')
m0 = tpl.index('const M=__DATA__;') + len('const M=__DATA__;')
m1 = tpl.index('\n// game', m0)
mapjs = tpl[m0:m1]

pre, ui = rd('scripts/editor.js').split('//==UI==')
shell = rd('scripts/ch1-shell.html')
assert shell.count('<script>') == 1 and '__MAP__' in shell and '__GAME__' in shell
out = shell.replace('<script>', '<script>' + pre + '</script>\n<script>', 1)
out = out.replace('__MAP__', 'const M=__DATA__;preEdits(M);' + mapjs, 1)
out = out.replace('__GAME__', rd('scripts/ch1-game.js'), 1)
out = out.rstrip() + '\n<script>' + ui + '</script>\n'
out = out.replace('__DATA__', blob, 1)
open(f'{ROOT}/prototypes/{key}-ch1.html', 'w', encoding='utf-8').write(out)

# safety check: the demo page carries exactly the same map data as the map page
a2 = out.index('const M=') + len('const M=')
assert out[a2:out.index(';preEdits(M);', a2)] == blob
print(f'{key}-ch1.html: {len(out) / 1e6:.2f} MB, map data sha1 {hashlib.sha1(blob.encode()).hexdigest()[:12]} (identical to {key}-monopoly.html)')
