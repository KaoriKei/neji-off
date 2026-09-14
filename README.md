# NEJI OFF — プロトタイプ

「ネジをタップして抜く × 同じ色のトレイに入れる」パズルの10面プロトタイプ。
仕様書は Google Drive `01_個人/Game/Neji_Off/NEJI_OFF_spec.md`（v0.3）。

## 動かす
```
npm install
npm run dev        # 開発サーバー（http://localhost:5173）
npm run build      # dist/ に静的ファイルを出力（Cloudflare Pages / Vercel / GitHub Pages で動く）
npm run preview    # build した dist/ を確認
```

## 検証
```
npm test           # Board / Solver の単体テスト（vitest）
npm run verify     # 全10面を形式チェック＋解けるか＋最小仮置き数を算出（仕様 6.1 の表と照合）
npx tsx scripts/solution.ts 5   # 5面の正解手順・覆われたネジ・詰ませる手順を座標つきで出力（開発用）
```

## 開発用URLパラメータ
- `?level=7` … タイトルを飛ばして7面から始める（プレイヤー向けのレベル選択ではない）

## 構成
```
src/
  main.ts            Phaser 起動（フォント読み込み待ち）
  scenes/            Title / Game / Result
  game/
    Level.ts         型定義・形式チェック
    Board.ts         ルール（覆い・トレイ・仮置き場・詰み・クリア）。Phaser 非依存
    Solver.ts        解けるか／最小仮置き数の探索。Phaser 非依存
    Juice.ts         演出（Board のイベント列を順番に再生）
    Sfx.ts           合成効果音
    Draw.ts          コード描画（板・ネジ・トレイ…）
    Theme.ts         配色・レイアウト定数
  data/levels/       01.json … 10.json
tests/               vitest
scripts/             verify-levels.ts / solution.ts
assets/              画像差し替え用（今は空）
```

## 自動プレイ（開発用）
```
npm run preview &
npx tsx scripts/solution.ts 7 > /tmp/sol7.json
node scripts/autoplay.mjs 7 /tmp/shots7 solve /tmp/sol7.json   # solve=正解手順でクリア / stuck=わざと詰ませる
```
ヘッドレス Chrome（/Applications/Google Chrome.app）で自動タップし、/tmp/shots7 にスクショと console.log を残す。
