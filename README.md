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
