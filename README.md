# NEJI OFF — 金属のパズル

**本番URL: https://kaorikei.github.io/neji-off/**

平面のチュートリアルから、360度回転できる金属のキューブへ進む全11レベルのパズル。同じ色のビスを3本そろえてトレイを交代し、5枠の一時置きを使いながらすべての板を外す。

- Lv1〜2：平面で基本操作・重なり・一時置きを覚える。
- Lv3：六面のキューブ、回転、内側から留めたビス。
- Lv4〜7：半分ほどの大きさの追加プレートが増える。
- Lv8〜11：二段に重なるプレート。最終面は15枚・45本。
- マットな金属と `#00AFCC` のアクセント。ビスの色は青・赤・紫・緑で、太い色リングを使う。

[操作・レベル構成・検証の詳細](prototype-3d/README.md)

## 開発とビルド

```sh
npm ci
npm run dev       # 完成版を開発サーバーのルートで表示
npm run build     # 本番・共有済みURL・従来版を dist/ にまとめる
npm run preview   # dist/ の公開配置を確認
```

`npm run dev` は `prototype-3d/vite.config.ts` を使う。開発時だけ `/?level=8` などで特定のレベルを確認できる。公開ビルドではLv1から開始する。

```sh
npm test
npm run verify
npx tsc --noEmit
```

- テストは全11レベルの進行・攻略可能性、板の覆い、頭の向き、支柱、履歴などを確認する。
- `verify` は従来の平面レベル11面について、形式・最小仮置き数・難易度を検証する。
- 立体の追加板の配色・攻略手順・難易度は `prototype-3d/layered-levels.json` に保持する。

## 本番公開

`main` へのpushで、GitHub Actionsがテスト・検証・型検査・ビルドを行い、GitHub Pagesへ公開する。開発ブランチへのpushでは本番を更新しない。

| URL | 内容 |
|---|---|
| https://kaorikei.github.io/neji-off/ | 本番の完成版 |
| https://kaorikei.github.io/neji-off/cube/ | 以前共有したURL。同じ完成版を表示 |
| https://kaorikei.github.io/neji-off/classic/ | 従来の平面版 |

すべて同じ `main` のコミットからビルドする。公開用の配置は `scripts/package-site.mjs` が作り、各URLのHTMLと参照するアセットの存在を確認する。公開処理は開発ブランチの存続に依存しない。

## 構成

- `prototype-3d/`：完成版の画面・3D描画・全11レベルの進行。
- `src/game/`：両方のゲームで共有する盤面ルールとソルバー。
- `src/data/levels/`：従来の平面レベル。完成版のLv2でも利用する。
- `src/scenes/`・`src/main.ts`・ルートの `index.html`：従来版のPhaser画面。
- `tests/`：盤面・進行・形状のテスト。
- `scripts/package-site.mjs`：GitHub Pagesの公開配置。
- `.github/workflows/deploy.yml`：mainからの本番公開。

従来版だけを確認する場合は `npm run dev:classic`、ビルドする場合は `npm run build:classic`（出力先 `.build/classic/`）を使う。完成版だけのビルドは `npm run build:3d`（出力先 `prototype-3d/dist/`）。
