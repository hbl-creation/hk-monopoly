# 香港地產大富翁

> **設計文件：** [香港地產遊戲設計文件（初稿）](https://claude.ai/artifact/9o4kvYLAKEBiSDwJBwisRx) — 改任何玩法、數值或者公司名之前先睇呢份。
> **公司名單：** `data/companies.json`（大地產商、虛構對手、小型業主，連屬性），由設計文件抄入。遊戲同編輯器都讀呢個檔；改名只改呢度，再跑 `build_html.py`。


## 資料夾
- `prototypes/` — 可以直接用瀏覽器打開嘅原型
  - `yuenlong-ch1.html`：**第一章元朗試玩版**（遊戲內 12 個月；手機直版優先，電腦都玩到）。由 `python3 scripts/build_ch1.py` 生成，地圖數據同 `yuenlong-monopoly.html` 完全一樣。審批同工期係壓縮咗嘅「試玩版數值」，之後要 revisit（見 `CLAUDE.md`）
  - `yuenlong-monopoly.html`：第一章元朗，市中心＋周邊農地，三級縮放（開發中）；地圖編輯用呢頁
  - `central-monopoly.html`：中上環及金鐘，三級縮放、地標、銀行、大地產商（最新）
  - `ytm-monopoly.html`：油尖旺街區版
  - `hk-board.html`：十八區棋盤地圖
  - `hk-occupy-map.html`：OpenStreetMap 底圖版（要上網）
  - `hk-sandtable.html`：3D 沙盤
- `data/` — 處理好嘅地圖數據（`central3.json` 係中環最新版，`yuenlong3.json` 係元朗）
- `scripts/` — 地圖處理程式（元朗：`yuenlong.py` → `yuenlong3.py`，範本 `yuenlong-template.html`）（Python：shapely、numpy）同 HTML 範本

## 數據來源
- OpenStreetMap（Geofabrik 2024 年 9 月香港數據，取自 GitHub ottoykh/ALS-Address）© OpenStreetMap contributors，ODbL 授權
- 18 區邊界：GitHub Paulkit/HKMap（MIT）
- 街道：GitHub hkstreets/maps

原始 OpenStreetMap 檔案太大冇放入嚟，要重新生成地圖時再下載。

## 編輯地圖
1. 打開 `prototypes/yuenlong-monopoly.html`，撳右邊「✎ 編輯地圖」
2. 🧽 擦路／🖌 補路：喺路上面掃過就擦走或補返（連路名）；🗑 刪地／🌱 補地：掃走多餘嘅土地（街區中心被掃到就成塊移除，連建築物）；筆刷大小可以調
3. ✋ 移動／改地：撳一塊街區，改類型（可買／農地／地產商／公園／政府…）、名稱、市值；地產商由下拉清單揀（新鴻記、置業集團、黃河集團、太府地產、順德集團、九龍及匯德峯，或新增）；「同另一塊合併」再撳隔籬嗰塊
4. 編輯會自動儲存喺瀏覽器；撳「⬇ 匯出」下載 `yuenlong-edits.json`，傳俾 Claude
5. Claude 跑 `python3 scripts/build_html.py yuenlong yuenlong-edits.json`：編輯併入 `edits/yuenlong.json`（總檔），重新生成原型頁。生成數據（`data/*3.json`）永遠唔會手改，所以重新跑地圖程式都唔會冇咗你嘅編輯

## 建築物數據
`scripts/csdi_buildings.py` 由地政總署 CSDI 空間數據共享平台（Building 數據集，WFS）下載建築物輪廓、中文名同層數，存喺 `data/<區>-bld.json`。CSDI 條款容許商業同非商業用途，頁面右下角已註明來源。`build_html.py` 會自動將建築物歸入街區，並用政府名稱補返街區名。

## 地段界線（街區跟真實地段）
`scripts/csdi_lots.py` 由 CSDI 下載地政總署「Lot」地段界線，將可買／地產商街區重新劃分：每個地段歸入重疊最多嘅分區，再將相鄰、性質相同（一般／農地／同一地產商）嘅地段合併到適合遊戲嘅大小（市區約 3,500 平方米、農地約 9,000 平方米），地段永遠唔會切開。公園、政府、學校、宗教、地標、銀行保留原本形狀。冇地段嘅政府土地（斜坡、巷、路邊）唔再係街區。輸出 `data/<區>4.json`，`build_html.py` 有 4 就用 4。
流程：`yuenlong.py` → `yuenlong3.py` → `csdi_buildings.py` → `csdi_lots.py` → `build_html.py`

## 河道、空隙同揀唔到嘅土地
- `scripts/osm_water.py`：魚塘、河流用 OpenStreetMap；河道再加渠務署「Engineered Channel」（CSDI）中線，按記錄闊度畫出真實河面
- `csdi_lots.py` 另外輸出 `data/<區>-gaplots.json`（全部政府地段）；`build_html.py` 修剪範圍時，可玩範圍入面未有地塊覆蓋嘅政府地段會補做地塊
- 成個可玩範圍都畫做陸地；唔係地塊嘅土地（政府土地、巷、斜坡）用較深嘅灰色，玩家一睇就知揀唔到；範圍外面係深灰藍色

## 背景地圖（範圍外，唔可以玩）
`scripts/context.py`：喺區嘅下載範圍四周多 2.5 公里，加入道路、路名、土地用途同河道（為咗簡潔，範圍外唔顯示建築物輪廓），存喺 `data/<區>-ctx.json`。`build_html.py` 會併入地圖；頁面以「銷售地域圖」方式顯示：範圍外照常顯示但淡化，可玩範圍用紅色粗邊框圍住。

## 法定分區（城規會分區計劃大綱圖）
`scripts/ozp_zones.py`：由城規會法定規劃綜合網站（www.ozp.tpb.gov.hk，「用途地帶」圖層）下載分區，存喺 `data/<區>-ozp.json`。`build_html.py` 用嚟：每塊地記低法定分區（編輯面板顯示）；冇地段嘅綠化地帶／休憩用地畫綠色並標名；用政府土地造出嚟嘅地塊如果屬綠化地帶、休憩用地或政府、機構或社區用地，就唔可以買（Herbert 親手改過嘅除外）。分區只用嚟分類，規劃限制仍然用遊戲數值。

## 地名
`scripts/geonames.py`：地政總署「地理名稱」（CSDI），村名同地區名存喺 `data/<區>-geonames.json`。冇名嘅可買地塊自動命名：鄉村式發展區或附近有村 → 「村名 N號地」；否則主要街道（跳過交匯處、公路、天橋）→ 「街名 N號地」；再唔得用最近地名。屋苑名嚟自地政總署建築物名稱。（map.gov.hk 本身條款唔准商業用途，所以用 CSDI 同一套數據，唔直接攞 map.gov.hk。）
