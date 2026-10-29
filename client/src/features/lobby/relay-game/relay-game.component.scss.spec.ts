import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  resolve(process.cwd(), 'src/features/lobby/relay-game/relay-game.component.scss'),
  'utf8',
);
const template = readFileSync(
  resolve(process.cwd(), 'src/features/lobby/relay-game/relay-game.component.html'),
  'utf8',
);

describe('RelayGameComponent projector layout', () => {
  it('reserves the fixed canvas height for public reveal only', () => {
    const sharedStage = styles.match(/\.stage-page\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const publicRevealStage = styles.match(/\.reveal-stage\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(sharedStage).toMatch(/min-height:\s*0/);
    expect(publicRevealStage).toMatch(/height:\s*calc\(100dvh - 56px\)/);
    expect(publicRevealStage).not.toMatch(/min-height:\s*1000px/);
    expect(template).toMatch(/\[class\.relay-page--reveal\]="canReviewRelayBook\(\)"/);
    expect(styles).toMatch(/\.relay-page--reveal\s*\{\s*--padding-bottom:\s*0/);
    expect(styles).toMatch(
      /\.stage-page\s*\{[\s\S]*?svg\s*\{\s*max-height:\s*min\(58dvh, calc\(100% - 170px\)\)/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 390px\) and \(max-height: 700px\)[\s\S]*?\.page-author\s*\{\s*align-items:\s*center;\s*flex-direction:\s*row/,
    );
    expect(styles).toMatch(
    /@media \(max-width: 390px\) and \(max-height: 700px\)[\s\S]*?\.stage-page svg\s*\{\s*width:\s*auto;\s*max-width:\s*100%;\s*height:\s*25dvh/,
    );
    expect(styles).toMatch(
      /@media \(min-height: 701px\)[\s\S]*?\.stage-page svg\s*\{\s*max-height:\s*58dvh/,
    );
  });
});
