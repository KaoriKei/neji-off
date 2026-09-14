import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 本番のゲーム画面。公開用のURL配置は scripts/package-site.mjs が担当する。
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 900 },
});
