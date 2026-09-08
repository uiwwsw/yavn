import { describe, expect, it } from 'vitest';
import { finishPortrait, portraitSources, presentPortrait, type PortraitFrame } from './portraitTransition';

const calm: PortraitFrame = { source: 'calm.webp', ratio: 0.5 };
const surprised: PortraitFrame = { source: 'surprised.webp', ratio: 0.6 };
const smile: PortraitFrame = { source: 'smile.webp', ratio: 0.5 };

describe('portrait dissolve scheduling', () => {
  it('presents the first decoded frame without a blank outgoing layer', () => {
    expect(presentPortrait({}, calm)).toEqual({ current: calm, previous: undefined });
  });

  it('retains the old expression until the new frame has finished dissolving', () => {
    const transition = presentPortrait({ current: calm }, surprised);
    expect(transition).toEqual({ current: surprised, previous: calm });
    expect(finishPortrait(transition, surprised.source)).toEqual({ current: surprised });
  });

  it('coalesces rapid expression changes into the latest prepared frame after an uninterrupted dissolve', () => {
    const active = presentPortrait({ current: calm }, surprised);
    expect(presentPortrait(active, smile)).toBe(active);
    const finished = finishPortrait(active, surprised.source);
    expect(presentPortrait(finished, smile)).toEqual({ current: smile, previous: surprised });
  });

  it('ignores an animation completion from a stale expression', () => {
    const active = presentPortrait({ current: surprised }, smile);
    expect(finishPortrait(active, surprised.source)).toBe(active);
  });

  it('can return to the outgoing expression without duplicating or removing its DOM frame', () => {
    const active = presentPortrait({ current: calm }, surprised);
    expect(portraitSources(active, calm.source)).toEqual([calm.source, surprised.source]);
    expect(presentPortrait(finishPortrait(active, surprised.source), calm)).toEqual({ current: calm, previous: surprised });
  });

  it('bounds mounted images to two painting frames and one latest request', () => {
    const active = presentPortrait({ current: calm }, surprised);
    expect(portraitSources(active, smile.source)).toEqual([calm.source, surprised.source, smile.source]);
    expect(portraitSources(finishPortrait(active, surprised.source), smile.source)).toEqual([surprised.source, smile.source]);
    const stable = { current: calm };
    expect(presentPortrait(stable, calm)).toBe(stable);
  });
});
