# 香港地產大富翁

設計文件：https://claude.ai/artifact/9o4kvYLAKEBiSDwJBwisRx

## 資料夾
- `prototypes/` — 可以直接用瀏覽器打開嘅原型
  - `yuenlong-monopoly.html`：第一章元朗，市中心＋周邊農地（牛屎地），三級縮放（開發中）
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
2. 🧽 擦路：喺路上面掃過就擦走（連路名）；🖌 補返：掃返出嚟；筆刷大小可以調
3. ✋ 移動／改地：撳一塊街區，改類型（可買／農地／地產商／公園／政府…）、名稱、地產商、市值；「同另一塊合併」再撳隔籬嗰塊
4. 編輯會自動儲存喺瀏覽器；撳「⬇ 匯出」下載 `yuenlong-edits.json`，傳俾 Claude
5. Claude 跑 `python3 scripts/build_html.py yuenlong yuenlong-edits.json`：編輯併入 `edits/yuenlong.json`（總檔），重新生成原型頁。生成數據（`data/*3.json`）永遠唔會手改，所以重新跑地圖程式都唔會冇咗你嘅編輯

## 建築物數據
`scripts/csdi_buildings.py` 由地政總署 CSDI 空間數據共享平台（Building 數據集，WFS）下載建築物輪廓、中文名同層數，存喺 `data/<區>-bld.json`。CSDI 條款容許商業同非商業用途，頁面右下角已註明來源。`build_html.py` 會自動將建築物歸入街區，並用政府名稱補返街區名。

## 地段界線（街區跟真實地段）
`scripts/csdi_lots.py` 由 CSDI 下載地政總署「Lot」地段界線，將可買／地產商街區重新劃分：每個地段歸入重疊最多嘅分區，再將相鄰、性質相同（一般／農地／同一地產商）嘅地段合併到適合遊戲嘅大小（市區約 3,500 平方米、農地約 9,000 平方米），地段永遠唔會切開。公園、政府、學校、宗教、地標、銀行保留原本形狀。冇地段嘅政府土地（斜坡、巷、路邊）唔再係街區。輸出 `data/<區>4.json`，`build_html.py` 有 4 就用 4。
流程：`yuenlong.py` → `yuenlong3.py` → `csdi_buildings.py` → `csdi_lots.py` → `build_html.py`
