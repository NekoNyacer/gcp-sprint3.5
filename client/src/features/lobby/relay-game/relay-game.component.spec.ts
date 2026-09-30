import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { RelayGameComponent } from './relay-game.component';

describe('RelayGameComponent drawing pad', () => {
  it('re-enables the drawing pad after an accepted submission', async () => {
    const pad = {
      off: vi.fn(),
      on: vi.fn(),
      clear: vi.fn(),
      getCanvas: () => ({ clientWidth: 640, clientHeight: 512 }),
      toData: () => [
        {
          points: [
            { x: 20, y: 30, pressure: 0.5, time: 1 },
            { x: 40, y: 50, pressure: 0.5, time: 2 },
          ],
        },
      ],
    };
    const component = Object.create(RelayGameComponent.prototype) as Record<string, unknown>;
    const hasInk = signal(true);
    Object.assign(component, {
      signaturePad: () => pad,
      hasInk,
      isSubmitting: signal(false),
      store: { submit: vi.fn().mockResolvedValue(true) },
      canvasWidth: 640,
      canvasHeight: 512,
    });

    await (component['submitPage'] as () => Promise<void>)();

    expect(pad.off).toHaveBeenCalledOnce();
    expect(pad.on).toHaveBeenCalledOnce();
    expect(hasInk()).toBe(false);
  });

  it('removes only the most recent stroke when undoing', () => {
    const strokes = [
      { points: [{ x: 20, y: 30, pressure: 0.5, time: 1 }] },
      { points: [{ x: 40, y: 50, pressure: 0.5, time: 2 }] },
    ];
    const pad = {
      toData: () => strokes,
      fromData: vi.fn(),
    };
    const component = Object.create(RelayGameComponent.prototype) as Record<string, unknown>;
    const hasInk = signal(true);
    Object.assign(component, { signaturePad: () => pad, hasInk, isSubmitting: signal(false) });

    (component['undoPad'] as () => void)();

    expect(pad.fromData).toHaveBeenCalledWith([strokes[0]]);
    expect(hasInk()).toBe(true);
  });

  it('clears the submit state after undoing the final stroke', () => {
    const pad = {
      toData: () => [{ points: [{ x: 20, y: 30, pressure: 0.5, time: 1 }] }],
      fromData: vi.fn(),
    };
    const component = Object.create(RelayGameComponent.prototype) as Record<string, unknown>;
    const hasInk = signal(true);
    Object.assign(component, { signaturePad: () => pad, hasInk, isSubmitting: signal(false) });

    (component['undoPad'] as () => void)();

    expect(pad.fromData).toHaveBeenCalledWith([]);
    expect(hasInk()).toBe(false);
  });
});
