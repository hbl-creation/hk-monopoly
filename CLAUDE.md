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
- `prototypes/yuenlong-monopoly.html` still runs the old Central prototype loop (buy / rent / events); Herbert uses
  it as the map + editor page.
- **Chapter-1 playable demo: `prototypes/yuenlong-ch1.html`** (12 in-game months, mobile portrait first, also
  desktop) — see "Chapter-1 demo" below. Branch **`ch1-demo`** (off `yuenlong-map`).
- Map work is on branch **`yuenlong-map`** (pushed). `main` has neither yet — ask Herbert before merging.
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

## Chapter-1 demo (`prototypes/yuenlong-ch1.html`)
Build: `python3 scripts/build_ch1.py` (also run automatically at the end of `build_html.py yuenlong`). It does **not**
regenerate the map: the data blob is copied byte-for-byte from `yuenlong-monopoly.html` (the script asserts this),
so both pages show the same map and share Herbert's in-browser edits. Never edit the built page by hand.

| file | what |
|---|---|
| `scripts/ch1-shell.html` | page shell: CSS, top bar, bottom dock, sheets, modals |
| `scripts/ch1-game.js` | game layer: `CFG` (all tunables), `USES`, rivals, events (`EV`), tutorial (`TUT`), annual report |
| `scripts/yuenlong-template.html` | map drawing code, reused as-is (everything before `// game`) |

Game state lives only in `S` (saved to localStorage `hkm-ch1-save-yuenlong`); map data `M` is read-only — starting
plots, 陸國集團's plots, small owners and rivals are assigned at game start, never written into the map. Company
names / attributes come from `M.companies` (`data/companies.json`); banks are shown under their design-doc names
(`CFG.BANK` 東方銀行, `CFG.FIN` 元合財務) while the map data keeps the original POI names.

In the demo: intro story → tutorial (buy out 陸國集團 → merge → apply) → monthly loop (buy, merge adjacent plots in
the same district block, change-of-use application, premium, build, rent or sell) → rivals 元朝地產 / 金煌實業 acting
on their attributes → 民意 + 鄉紳 (simple versions) → 16 black-humour event cards → annual report with ranking and
chapter-2 unlock check. Left out on purpose: builder tiers, flat sizes, reputation / dirty tricks, shares and
takeovers, government tenders, businesses, mortgages, other factions, three-step policy events.

### ⚠️ Demo values to REVISIT (Herbert, Nov 2026: "mark it, revisit later")
All in `CFG` / `USES` at the top of `scripts/ch1-game.js`:
- **Compressed timings (試玩版數值, labelled in the UI):** approval 1 month, village houses 2 months, housing
  4 months (`APPROVE_MONTHS`, `BUILD_MONTHS`). Design doc: approval 3–9 months, construction 12–36 months.
- **Demo length 12 months** (`MONTHS`); design doc chapter 1 is 5 years.
- **Start and unlock numbers (not in the design doc, agreed for the demo):** 50 億 cash + 4 adjacent farm plots in
  元朗東; unlock chapter 2 at worth ≥ 1.5 × start and above 元朝地產; below start worth = 敗家.
- **Money balance is a first pass:** `USES` multipliers, approval chances, rents, loan terms, rival budgets. Land
  prices are still the old area-weighted estimates (next step 2 below). Scripted bots finish the year at about
  2–3 × start worth, so the demo is on the easy side.
- **舊樓重建 (merged urban plots → new housing)** was added so the tutorial's merged 陸國 site has a use; the design
  doc only introduces redevelopment in chapter 3. Remove the `urban` entry in `USES` to drop it.
- 陸國集團's plots and the player's start plots are picked by rule at game start (`CFG.LUK_AT` / `CFG.START_AT`
  pin them to plot centres). Big developers' off-map assets in the ranking are rough estimates (`OFFMAP`).
- 元合財務 (finance company, named by Herbert) is not yet in the design doc's 名稱對照表.

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
3. Chapter-1 systems from the design doc — first playable version done as the 12-month demo (see "Chapter-1
   demo"); next: Herbert's play-test notes, then the "Demo values to REVISIT" list, then the left-out systems.
4. Merge `yuenlong-map` into `main`, host via Cloudflare so Herbert can test on his phone (design doc: mobile
   portrait first).

## Open questions for Herbert
- District names stay as they are (元朗市中心 / 朗屏 / 元朗東 are common names, not official ones) — Herbert decided.
- South-east farmland east of 元朗公路 kept playable — confirm.
- Very large government land (> 60,000 m²) stays unplayable; small leftover plots (≥150 m²) — fold into neighbours?
