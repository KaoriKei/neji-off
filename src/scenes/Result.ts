// クリア画面（Game の上に重ねる）。最終面のあとは「ここまで」画面。
import Phaser from 'phaser';
import { BASE_H, BASE_W } from '../game/Level';
import * as T from '../game/Theme';
import * as D from '../game/Draw';

export class Result extends Phaser.Scene {
  private level = 0;
  private isLast = false;

  constructor() {
    super('Result');
  }

  init(data: { level: number; isLast: boolean }): void {
    this.level = data.level;
    this.isLast = data.isLast;
  }

  create(): void {
    const dim = this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000, 0.25).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 250 });

    const panelW = 760;
    const panelH = this.isLast ? 620 : 520;
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.1);
    pg.fillRoundedRect(-panelW / 2 - 2, -panelH / 2 + 14, panelW + 4, panelH, 40);
    pg.fillStyle(T.TRAY_BAND, 1);
    pg.fillRoundedRect(-panelW / 2, -panelH / 2 + 8, panelW, panelH, 40);
    pg.fillStyle(T.TRAY_FILL, 1);
    pg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 40);

    const title = this.add
      .text(0, -panelH / 2 + 130, this.isLast ? 'ここまで！' : 'クリア！', {
        fontFamily: T.FONT, fontSize: '96px', color: '#3A3A3A', fontStyle: '800',
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [pg, title];
    if (this.isLast) {
      children.push(
        this.add
          .text(0, -panelH / 2 + 250, 'あそんでくれてありがとう', { fontFamily: T.FONT, fontSize: '40px', color: '#3A3A3A', fontStyle: '800' })
          .setOrigin(0.5),
      );
    }

    const btnW = 380;
    const btnH = 130;
    const btnY = panelH / 2 - 130;
    const bg = this.add.graphics();
    D.drawWideButton(bg, btnW, btnH);
    const label = this.add
      .text(0, -4, this.isLast ? 'タイトルへ' : 'つぎへ', { fontFamily: T.FONT, fontSize: '52px', color: '#FFFFFF', fontStyle: '800' })
      .setOrigin(0.5);
    const btn = this.add.container(0, btnY, [bg, label]);
    children.push(btn);

    const panel = this.add.container(BASE_W / 2, BASE_H / 2, children).setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const lx = p.x - BASE_W / 2;
      const ly = p.y - BASE_H / 2 - btnY;
      if (Math.abs(lx) > btnW / 2 + 20 || Math.abs(ly) > btnH / 2 + 20) return;
      this.tweens.add({ targets: btn, scale: 0.92, duration: 60, yoyo: true });
      this.time.delayedCall(90, () => this.next());
    });
  }

  private next(): void {
    if (this.isLast) {
      this.scene.stop('Game');
      this.scene.start('Title');
      return;
    }
    const game = this.scene.get('Game');
    this.scene.stop();
    game.scene.restart({ level: this.level + 1 });
  }
}
