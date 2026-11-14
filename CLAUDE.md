# 香港地產大富翁 — handoff notes for Claude

Read this first, then the design doc. Talk to Herbert in Cantonese (Traditional Chinese); he is the designer and decides
gameplay, names and boundaries. Discuss designs before building big systems.

- **Design doc (source of truth for gameplay, numbers, company names):**
  https://claude.ai/artifact/9o4kvYLAKEBiSDwJBwisRx (a Claude Doc — read/edit it with the Claude Docs tools)
- **Company list used by the game:** `data/companies.json` (copied from the design doc: 大地產商 / 虛構對手 / 小型業主).
  Change names there, never hard-code them. Real companies always get sound-alike names.
- "牛屎地" is Herbert's inside joke — never use it in game text (say 農地).

## Where things stand (Nov 2026)
- Chapter 1 map **元朗** is close to final: `prototypes/yuenlong-monopoly.html` (open in a browser; ~3 MB, self-contained).
  1,170 plots on real government land lots, developer ownership set by Herbert, play area trimmed by him,
  territory-map style (background map outside, red outline around the play area).
- Gameplay in the prototype is still the old Central prototype loop (buy / rent / AI rival 元朝地產 / events).
  None of the design doc's chapter-1 systems are built yet.
- Work is on branch **`yuenlong-map`** (pushed). `main` does not have it yet — ask Herbert before merging.
- Older prototypes: `central-monopoly.html` (中上環), `ytm-monopoly.html` (油尖旺); `prototypes/index.html` lists them;
  `wrangler.jsonc` = Cloudflare Worker config for hosting the prototypes.

## Map pipeline (Yuen Long; box 114.010–114.045 E, 22.433–22.458 N)
Run from the repo root. Raw OSM: Geofabrik HK extract from github.com/ottoykh/ALS-Address (folder `OpenStreetMap`,
unzip into `/home/claude/hkmap/dl/als/OpenStreetMap/`). Network: needs `portal.csdi.gov.hk`, `data.gov.hk`,
`www.ozp.tpb.gov.hk` allowed (Herbert has allowed them).

| step | script | output |
|---|---|---|
| OSM street blocks, first plots | `scripts/yuenlong.py` → `scripts/yuenlong3.py` | `data/yuenlong3.json` |
| LandsD building footprints + names (CSDI) | `scripts/csdi_buildings.py yuenlong 114.010 114.045 22.433 22.458` | `data/yuenlong-bld.json` |
| plots rebuilt on LandsD land lots (CSDI) | `scripts/csdi_lots.py yuenlong …same box…` | `data/yuenlong4.json`, `data/yuenlong-gaplots.json` |
| water: OSM ponds + DSD engineered channels | `scripts/osm_water.py yuenlong …` | `data/yuenlong-water.json` |
| background map around the district | `scripts/context.py yuenlong …` | `data/yuenlong-ctx.json` |
| statutory zoning (TPB OZP) | `scripts/ozp_zones.py yuenlong …` | `data/yuenlong-ozp.json` |
| official place names (LandsD) | `scripts/geonames.py yuenlong …` | `data/yuenlong-geonames.json` |
| **build the page** | `python3 scripts/build_html.py yuenlong [herbert-export.json]` | `prototypes/yuenlong-monopoly.html` |

Usually only the last step is needed. `build_html.py` applies, in order: Herbert's master edits (`edits/yuenlong.json`:
land wipes, `cut` polygons, merges, per-plot edits keyed by plot centre), government buildings → plot names,
trim to the play area (fills gaps with unused government lots, turns unleased land into plots, classifies public
buildings, splits districts per piece), zoning tags, auto-names (`村名/街名 N號地`), background map.
Generated data (`data/*3.json`, `data/*4.json`) is never hand-edited — edits live in `edits/`.

## Herbert's edit workflow
In the page: **✎ 編輯地圖** → tools 🧽擦路 / 🖌補路 / 🗑刪地 / 🌱補地, tap a plot to change type / name / owner (dropdown from
`companies.json`) / price, merge plots. Edits save in his browser; **⬇ 匯出** downloads `yuenlong-edits.json`, he
attaches it, you run `build_html.py yuenlong <file>`. Exports are merged into the master (union), and land wipes
already baked into the page are kept. Plot ids change between builds — always refer to plots by centre/name, and
check which build an export came from (`build` field) if centres don't match.

## Data sources and licence notes
- CSDI Portal data (LandsD lots, buildings, geographic names; DSD channels): free for commercial use; credit shown
  bottom-right of the page. map.gov.hk itself forbids commercial reuse — use the CSDI datasets instead.
- TPB zoning: Statutory Planning Portal map service, layer 1000 (`…/SPP3/OZP_PLAN/MapServer/1000/query`).
  Zoning only classifies land; game planning limits stay game values (design doc).
- Still from OpenStreetMap: roads + road names, land-use colours outside the play area, landmark/bank POIs,
  fishponds. Replacements tested and available: LandsD Road Centreline (`landsd_rcd_1637310758814_80061`,
  types Highway/Main/Secondary/Track, Chinese names), LandsD Government Land Allocation
  (`landsd_rcd_1637218348584_91735`).

## Suggested next steps (agreed with Herbert, in order)
1. Swap roads / road names to LandsD Road Centreline; Herbert does a final pass in edit mode.
2. Re-price land from government data (storeys, building cover, zone, near MTR/West Rail, main roads,
   farmland vs village vs estate). Current prices were only area-weighted from the first OSM estimate.
3. Chapter-1 systems from the design doc: rivals (元朝地產 main, 金煌實業 speculator), tutorial target 陸國集團,
   merging adjacent plots, change-of-use applications (district council / Town Planning Board, waiting time),
   public opinion (民意), village faction (鄉紳).
4. Merge `yuenlong-map` into `main`, host via Cloudflare so Herbert can test on his phone (design doc: mobile
   portrait first).

## Open questions for Herbert
- District names stay as they are (元朗市中心 / 朗屏 / 元朗東 are common names, not official ones) — Herbert decided.
- South-east farmland east of 元朗公路 kept playable — confirm.
- Very large government land (> 60,000 m²) stays unplayable; small leftover plots (≥150 m²) — fold into neighbours?
