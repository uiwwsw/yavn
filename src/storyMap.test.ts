import { describe, expect, it } from 'vitest';
import { buildStoryChapter, layoutStoryMap, storyEdgeId, storyNodeId, visibleStoryChapter } from './storyMap';
import { parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import type { GameData } from './types';
const id = (scene: string, action = 0) => storyNodeId('./0.yaml', scene, action);
const game: GameData = {
  meta: { title: 'Map' }, settings: { autoSave: true, textSpeed: 30, clickToInstant: true },
  assets: { backgrounds: { palace: 'palace.webp' }, characters: {}, music: {}, sfx: {} },
  script: [{ scene: 'entry' }], scenes: {
    entry: { actions: [{ bg: 'palace' }, { say: { text: 'Opening' } }, { choice: { prompt: 'Choose', options: [
      { text: 'Left', goto: 'left' }, { text: 'Secret right', goto: 'right' }, { text: 'Fatal', gameOver: { title: 'Secret death' } },
      { text: 'Other left', goto: 'left' },
    ] } }] },
    left: { actions: [{ goto: 'merge' }] },
    right: { actions: [{ say: { text: 'Secret right dialogue' } }, { goto: 'merge' }] },
    merge: { actions: [{ choice: { prompt: 'Again?', options: [{ text: 'Loop', goto: 'entry' }, { text: 'Next', goto: './1' }] } }] },
  },
};
const chapter = () => buildStoryChapter(game, './0.yaml', 1, p => `/media/${p}`);
describe('story map control flow and spoiler boundary', () => {
  it('builds forks, merged scenes, cycles, direct deaths, and cross-chapter links', () => {
    const map = chapter();
    expect(map.nodes.find(n => n.id === id('entry', 2))).toMatchObject({ kind: 'choice', image: '/media/palace.webp' });
    expect(map.edges.filter(e => e.from === id('entry', 2))).toHaveLength(4);
    expect(map.nodes.filter(n => n.id === id('merge'))).toHaveLength(1);
    expect(map.edges).toContainEqual({ from: id('merge'), to: 'chapter:./1.yaml', label: 'Next' });
    const positions = layoutStoryMap(map.nodes, map.edges);
    expect(new Set(positions.map(n => `${n.x},${n.y}`)).size).toBe(map.nodes.length);
  });
  it('hides all text, media, outcome kinds, and downstream nodes beyond visited frontier', () => {
    const visible = visibleStoryChapter(chapter(), [{ id: id('entry'), replayable: true }, { id: id('entry', 2), replayable: true }], []);
    const locked = visible.nodes.filter(n => !n.unlocked);
    expect(locked).toHaveLength(3);
    expect(locked.every(n => n.title === '아직 펼치지 않은 이야기' && !n.image && !n.portrait && n.kind === 'scene')).toBe(true);
    expect(visible.nodes.some(n => n.id === id('merge'))).toBe(false);
    expect(visible.edges.every(e => e.label === undefined)).toBe(true);
  });
  it('does not reveal unselected options that merge into the same scene', () => {
    const visible = visibleStoryChapter(chapter(), [{ id: id('entry', 2), replayable: true }, { id: id('left'), replayable: true }],
      [storyEdgeId(id('entry', 2), id('left'))], { [id('entry', 2)]: ['Left'] });
    expect(visible.edges.filter(e => e.taken).map(e => e.label)).toEqual(['Left']);
    expect(visible.edges.some(e => e.label === 'Other left')).toBe(false);
  });
  it('follows actions after a choice without a goto instead of skipping to the next chapter', () => {
    const map = buildStoryChapter({ ...game, scenes: { ...game.scenes, entry: { actions: [
      { choice: { prompt: 'Continue', options: [{ text: 'Yes' }] } }, { goto: 'left' },
    ] } } }, './0.yaml', 1, p => p, './1.yaml');
    expect(map.edges).toContainEqual({ from: id('entry'), to: id('entry', 1), label: 'Yes' });
    expect(map.edges).toContainEqual({ from: id('entry', 1), to: id('left'), label: undefined });
  });
  it('preserves optional authored chapter and scene titles through the production parser', () => {
    const config = parseConfigYaml('title: Map\ntextSpeed: 30\nautoSave: true\nclickToInstant: true\n', './config.yaml').data!;
    const parsed = parseChapterYaml('chapterTitle: 첫 번째 밤\nscript: [{scene: intro}]\nscenes:\n  intro:\n    title: 닫힌 문\n    actions: [{say: {text: Hello}}]', './0.yaml');
    expect(parsed.error).toBeUndefined();
    const resolved = resolveChapterGame({ config, bases: [], chapter: parsed.data! }).data!;
    const map = buildStoryChapter(resolved, './0.yaml', 1, p => p);
    expect(map.title).toBe('첫 번째 밤');
    expect(map.nodes[0].title).toBe('닫힌 문');
  });
});
