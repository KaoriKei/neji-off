import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 }, // Phaser 本体が 1.2MB あるので警告を黙らせる
});
