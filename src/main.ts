// Phaser 起動。丸ゴシック（M PLUS Rounded 1c）の読み込みを待ってから始める。
import Phaser from 'phaser';
import { BASE_H, BASE_W } from './game/Level';
import { Game } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';

async function waitFont(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.load('800 64px "M PLUS Rounded 1c"'),
      new Promise((res) => setTimeout(res, 2500)), // 遅い回線でも 2.5 秒で諦めて始める
    ]);
  } catch {
    /* フォントが無くても起動する */
  }
}

void waitFont().then(() => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: BASE_W,
    height: BASE_H,
    backgroundColor: '#F5EFE3',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Title, Game, Result],
    input: { activePointers: 1 },
    render: { antialias: true },
  });
});
