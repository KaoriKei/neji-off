import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 既存の公開版とは別に、3D試作だけをビルドする。
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 900 },
});
