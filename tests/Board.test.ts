import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/Board';
import { validateLevel, type LevelDef } from '../src/game/Level';

// 仕様書 6 のサンプル（赤3・青3、板Bを先に外す→板A）
const SAMPLE: LevelDef = {
  id: 1,
  plates: [
    {
      id: 'A', x: 240, y: 700, w: 600, h: 300, z: 0, color: 'cream',
      screws: [
        { x: 280, y: 740, color: 'red' },
        { x: 800, y: 740, color: 'red' },
        { x: 800, y: 960, color: 'blue' },
      ],
    },
    {
      id: 'B', x: 440, y: 600, w: 400, h: 300, z: 1, color: 'mint',
      screws: [
        { x: 480, y: 640, color: 'red' },
        { x: 800, y: 640, color: 'blue' },
        { x: 640, y: 860, color: 'blue' },
      ],
    },
  ],
  trays: ['red', 'blue'],
  bufferSize: 5,
};

describe('validateLevel', () => {
  it('サンプルは形式チェックに通る', () => {
    expect(validateLevel(SAMPLE)).toEqual([]);
  });
  it('3の倍数でない色は警告', () => {
    const bad: LevelDef = { ...SAMPLE, plates: [{ ...SAMPLE.plates[0], screws: [{ x: 300, y: 800, color: 'red' }] }], trays: ['red'] };
    expect(validateLevel(bad).some((w) => w.includes('3の倍数'))).toBe(true);
  });
  it('上の板のフチに近すぎるネジは警告', () => {
    const bad: LevelDef = JSON.parse(JSON.stringify(SAMPLE));
    bad.plates[0].screws[0] = { x: 420, y: 740, color: 'red' }; // 板B左端(440)から20px
    expect(validateLevel(bad).some((w) => w.includes('フチまで'))).toBe(true);
  });
});

describe('Board 基本', () => {
  it('初期トレイは先頭3つ、足りなければ空枠', () => {
    const b = new Board(SAMPLE);
    const s = b.snapshot();
    expect(s.trays).toEqual([{ color: 'red', count: 0 }, { color: 'blue', count: 0 }, null]);
    expect(s.queue).toEqual([]);
  });

  it('覆われたネジは抜けない（coveredBy に上の板）', () => {
    const b = new Board(SAMPLE);
    expect(b.canPull('A-1')).toEqual({ ok: false, reason: 'covered', coveredBy: 'B' });
    expect(b.pull('A-1').ok).toBe(false);
  });

  it('同色トレイへ入る → 3本で完了 → キュー切れなら空枠', () => {
    const b = new Board(SAMPLE);
    expect(b.pull('B-0')).toEqual({ ok: true, events: [{ type: 'screwToTray', screwId: 'B-0', trayIndex: 0, slot: 0 }] });
    expect(b.pull('A-0')).toEqual({ ok: true, events: [{ type: 'screwToTray', screwId: 'A-0', trayIndex: 0, slot: 1 }] });
    // B の残り2本（青）を抜くと板Bが落ちる
    const r1 = b.pull('B-1');
    expect(r1.ok && r1.events).toEqual([{ type: 'screwToTray', screwId: 'B-1', trayIndex: 1, slot: 0 }]);
    const r2 = b.pull('B-2');
    expect(r2.ok && r2.events).toEqual([
      { type: 'screwToTray', screwId: 'B-2', trayIndex: 1, slot: 1 },
      { type: 'plateDropped', plateId: 'B' },
    ]);
    // 板Bが落ちたので A-1 が抜けるようになる → 赤トレイ完了（キュー切れ → 空枠）
    const r3 = b.pull('A-1');
    expect(r3.ok && r3.events).toEqual([
      { type: 'screwToTray', screwId: 'A-1', trayIndex: 0, slot: 2 },
      { type: 'trayCompleted', trayIndex: 0 },
    ]);
    expect(b.snapshot().trays[0]).toBeNull();
    // 最後の青
    const r4 = b.pull('A-2');
    expect(r4.ok && r4.events).toEqual([
      { type: 'screwToTray', screwId: 'A-2', trayIndex: 1, slot: 2 },
      { type: 'plateDropped', plateId: 'A' },
      { type: 'trayCompleted', trayIndex: 1 },
      { type: 'cleared' },
    ]);
    expect(b.isCleared()).toBe(true);
    expect(b.isStuck()).toBe(false);
  });

  it('抜いたネジはもう抜けない', () => {
    const b = new Board(SAMPLE);
    b.pull('B-0');
    expect(b.canPull('B-0')).toEqual({ ok: false, reason: 'pulled' });
  });
});

// 仮置き場と吸い込みの検証用：1枚の板に色違いのネジ、トレイは順番待ち
const BUFFER_LV: LevelDef = {
  id: 99,
  plates: [
    {
      id: 'A', x: 100, y: 400, w: 880, h: 400, z: 0, color: 'cream',
      screws: [
        { x: 200, y: 500, color: 'blue' },
        { x: 400, y: 500, color: 'blue' },
        { x: 600, y: 500, color: 'blue' },
        { x: 800, y: 500, color: 'red' },
      ],
    },
    {
      id: 'B', x: 100, y: 900, w: 880, h: 400, z: 1, color: 'mint',
      screws: [
        { x: 200, y: 1000, color: 'red' },
        { x: 400, y: 1000, color: 'red' },
      ],
    },
  ],
  trays: ['red', 'blue'],
  bufferSize: 5,
};

describe('仮置き場と吸い込み', () => {
  it('同色トレイが無いと仮置き場へ（左詰め）', () => {
    // トレイを赤1枚だけにして青は仮置き場行きにする
    const lv: LevelDef = { ...BUFFER_LV, trays: ['red', 'blue'] };
    const b = new Board(lv, { bufferSize: 2 });
    // 初期トレイは red, blue の2枠なので青は入る。青トレイを無くすため、キューを組み替える
    const lv2: LevelDef = { ...lv, trays: ['red', 'red', 'red', 'blue'] };
    const b2 = new Board(lv2, { bufferSize: 2 });
    expect(b2.snapshot().trays.map((t) => t?.color)).toEqual(['red', 'red', 'red']);
    expect(b2.pull('A-0')).toEqual({ ok: true, events: [{ type: 'screwToBuffer', screwId: 'A-0', bufferIndex: 0 }] });
    expect(b2.pull('A-1')).toEqual({ ok: true, events: [{ type: 'screwToBuffer', screwId: 'A-1', bufferIndex: 1 }] });
    // 仮置き場満杯 → 青は抜けない
    expect(b2.canPull('A-2')).toEqual({ ok: false, reason: 'full' });
    expect(b.bufferSize).toBe(2);
  });

  it('新トレイ到着で仮置き場から吸い込み → 左詰め', () => {
    // 初期: red, red, red（3枠）。青3本は仮置き場へ。赤3本でトレイ完了 → blue 到着 → 青3本吸い込み
    const lv: LevelDef = { ...BUFFER_LV, trays: ['red', 'red', 'red', 'blue'] };
    // 板Bを無くして全部抜けるようにする（赤3本は板Aにまとめる）
    const lv2: LevelDef = {
      ...lv,
      plates: [
        {
          id: 'A', x: 100, y: 400, w: 880, h: 400, z: 0, color: 'cream',
          screws: [
            { x: 200, y: 500, color: 'blue' },
            { x: 400, y: 500, color: 'red' },
            { x: 600, y: 500, color: 'blue' },
            { x: 800, y: 500, color: 'blue' },
          ],
        },
        {
          id: 'B', x: 100, y: 900, w: 880, h: 400, z: 1, color: 'mint',
          screws: [
            { x: 200, y: 1000, color: 'red' },
            { x: 400, y: 1000, color: 'red' },
          ],
        },
      ],
      trays: ['red', 'red', 'red', 'blue'],
    };
    const b = new Board(lv2, { bufferSize: 5 });
    b.pull('A-0'); // blue → buffer 0
    b.pull('B-0'); // red → tray 0 slot 0
    b.pull('A-2'); // blue → buffer 1
    b.pull('B-1'); // red → tray 0 slot 1, plate B dropped
    b.pull('A-3'); // blue → buffer 2
    const r = b.pull('A-1'); // red → tray 0 slot 2 → 完了 → blue 到着 → 青3本吸い込み → 青トレイ完了 → キュー切れ → 板A落下 → cleared
    expect(r.ok && r.events).toEqual([
      { type: 'screwToTray', screwId: 'A-1', trayIndex: 0, slot: 2 },
      { type: 'plateDropped', plateId: 'A' },
      { type: 'trayCompleted', trayIndex: 0 },
      { type: 'trayArrived', trayIndex: 0, color: 'blue' },
      { type: 'bufferSucked', screwId: 'A-0', fromBufferIndex: 0, trayIndex: 0, slot: 0 },
      { type: 'bufferSucked', screwId: 'A-2', fromBufferIndex: 1, trayIndex: 0, slot: 1 },
      { type: 'bufferSucked', screwId: 'A-3', fromBufferIndex: 2, trayIndex: 0, slot: 2 },
      { type: 'trayCompleted', trayIndex: 0 },
      { type: 'cleared' },
    ]);
    expect(b.snapshot().buffer).toEqual([]);
  });

  it('吸い込み後に残ったネジは左詰め（bufferCompacted）', () => {
    const lv: LevelDef = {
      id: 98,
      plates: [
        {
          id: 'A', x: 100, y: 400, w: 880, h: 400, z: 0, color: 'cream',
          screws: [
            { x: 200, y: 500, color: 'yellow' },
            { x: 400, y: 500, color: 'blue' },
            { x: 600, y: 500, color: 'red' },
            { x: 800, y: 500, color: 'red' },
          ],
        },
        {
          id: 'B', x: 100, y: 900, w: 880, h: 400, z: 1, color: 'mint',
          screws: [
            { x: 200, y: 1000, color: 'red' },
            { x: 400, y: 1000, color: 'blue' },
            { x: 600, y: 1000, color: 'blue' },
            { x: 800, y: 1000, color: 'yellow' },
          ],
        },
        {
          id: 'C', x: 100, y: 1350, w: 880, h: 100, z: 2, color: 'grey',
          screws: [{ x: 200, y: 1400, color: 'yellow' }],
        },
      ],
      trays: ['red', 'red', 'red', 'blue', 'yellow'],
      bufferSize: 5,
    };
    const b = new Board(lv);
    b.pull('A-0'); // yellow → buffer[0]
    b.pull('A-1'); // blue → buffer[1]
    b.pull('C-0'); // yellow → buffer[2], plate C dropped
    b.pull('A-2'); // red → tray0
    b.pull('A-3'); // red → tray0, plate A dropped
    const r = b.pull('B-0'); // red → tray0 完了 → blue 到着 → buffer[1] 吸い込み → 左詰め
    expect(r.ok && r.events).toEqual([
      { type: 'screwToTray', screwId: 'B-0', trayIndex: 0, slot: 2 },
      { type: 'trayCompleted', trayIndex: 0 },
      { type: 'trayArrived', trayIndex: 0, color: 'blue' },
      { type: 'bufferSucked', screwId: 'A-1', fromBufferIndex: 1, trayIndex: 0, slot: 0 },
      { type: 'bufferCompacted', moves: [{ screwId: 'C-0', from: 2, to: 1 }] },
    ]);
    expect(b.snapshot().buffer).toEqual(['A-0', 'C-0']);
  });

  it('同色トレイが複数あるときは左優先', () => {
    const lv: LevelDef = { ...BUFFER_LV, trays: ['blue', 'red', 'blue'] };
    const b = new Board(lv);
    const r = b.pull('A-0');
    expect(r.ok && r.events[0]).toEqual({ type: 'screwToTray', screwId: 'A-0', trayIndex: 0, slot: 0 });
  });

  it('仮置き場満杯で抜けるネジが無ければ stuck', () => {
    // 板A（下）に青3本・赤1本、板B（上）に赤2本。トレイは red だけ先に出る。青は仮置き場（2穴）へ
    const lv: LevelDef = { ...BUFFER_LV, trays: ['red', 'blue'] };
    const b = new Board(lv, { bufferSize: 1 });
    // blue トレイは初期表示にあるので青は入ってしまう。青トレイを後ろに回す
    const lv2: LevelDef = { ...lv, trays: ['red', 'red', 'red', 'red', 'blue'] };
    const b2 = new Board(lv2, { bufferSize: 1 });
    b2.pull('A-0'); // blue → buffer（満杯）
    // 残り: A-1 blue, A-2 blue（仮置き満杯・青トレイ無し→抜けない）, A-3 red（B に覆われている? いいえ、A-3 は (800,500) で B は y900〜 → 覆われていない）
    // A-3 red は red トレイに入る → まだ詰みではない
    expect(b2.isStuck()).toBe(false);
    b2.pull('A-3'); // red → tray0
    b2.pull('B-0'); // red → tray0
    const r = b2.pull('B-1'); // red → tray0 完了 → 次の red 到着（青は吸い込まれない）→ 板B落下 → 詰み
    expect(r.ok && r.events.map((e) => e.type)).toEqual(['screwToTray', 'plateDropped', 'trayCompleted', 'trayArrived', 'stuck']);
    expect(b2.isStuck()).toBe(true);
    expect(b.bufferSize).toBe(1);
  });
});

describe('clone / stateKey', () => {
  it('clone は元の状態に影響しない', () => {
    const b = new Board(SAMPLE);
    const c = b.clone();
    c.pull('B-0');
    expect(b.getScrew('B-0')!.pulled).toBe(false);
    expect(c.getScrew('B-0')!.pulled).toBe(true);
    expect(b.stateKey()).not.toEqual(c.stateKey());
  });
});
