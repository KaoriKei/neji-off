// タイトル：タップでスタート。説明文は出さない。
import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../game/Level';
import { Sfx } from '../game/Sfx';
import * as T from '../game/Theme';
import * as D from '../game/Draw';

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    // 開発用：?level=N で N 面から直接始める（プレイヤー向けのレベル選択ではない）
    const q = new URLSearchParams(location.search).get('level');
    if (q && /^\d+$/.test(q)) {
      this.registry.set('sfx', new Sfx());
      this.scene.start('Game', { level: Number(q) - 1 });
      return;
    }

    D.drawBackground(this.add.graphics(), BASE_W, BASE_H);

    // 飾りのネジ（4色）
    const colors = ['red', 'blue', 'yellow', 'green'] as const;
    colors.forEach((c, i) => {
      const g = this.add.graphics();
      D.drawScrew(g, c);
      const cont = this.add.container(300 + i * 160, 620, [g]).setScale(1.6);
      this.tweens.add({ targets: cont, y: 600, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    this.add
      .text(BASE_W / 2, 820, 'NEJI OFF', { fontFamily: T.FONT, fontSize: '140px', color: '#3A3A3A', fontStyle: '800' })
      .setOrigin(0.5);

    const sub = this.add
      .text(BASE_W / 2, 1060, 'タップでスタート', { fontFamily: T.FONT, fontSize: '48px', color: '#3A3A3A', fontStyle: '800' })
      .setOrigin(0.5);
    this.tweens.add({ targets: sub, alpha: 0.35, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.input.once('pointerdown', () => {
      const sfx = (this.registry.get('sfx') as Sfx | undefined) ?? new Sfx();
      sfx.unlock();
      this.registry.set('sfx', sfx);
      this.scene.start('Game', { level: 0 });
    });
  }
}
