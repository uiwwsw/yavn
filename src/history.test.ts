import { describe, expect, it } from 'vitest';
import { appendStoryLogEntry, MAX_STORY_LOG_ENTRIES, selectRouteHistoryForChapter } from './history';
import type { RouteHistoryEntry, StoryLogEntry } from './types';

const dialogue = (index: number): StoryLogEntry => ({
  kind: 'dialogue',
  speaker: '코난',
  text: `대사 ${index}`,
  chapterPath: 'routes/hub/1.yaml',
  sceneId: 'hub',
  actionIndex: index,
});

describe('appendStoryLogEntry', () => {
  it('deduplicates the latest entry when the current action is restored from autosave', () => {
    const entry = dialogue(1);
    const history = appendStoryLogEntry([entry], entry);

    expect(history).toHaveLength(1);
  });

  it('keeps a repeated line when another event happened between visits', () => {
    const entry = dialogue(1);
    const choice: StoryLogEntry = {
      kind: 'choice',
      prompt: '어디로 갈까?',
      value: '다실',
      chapterPath: 'routes/hub/1.yaml',
      sceneId: 'hub',
      actionIndex: 2,
    };
    const history = appendStoryLogEntry(appendStoryLogEntry([entry], choice), entry);

    expect(history).toHaveLength(3);
  });

  it('keeps only the newest bounded history', () => {
    let history: StoryLogEntry[] = [];
    for (let index = 0; index <= MAX_STORY_LOG_ENTRIES; index += 1) {
      history = appendStoryLogEntry(history, dialogue(index));
    }

    expect(history).toHaveLength(MAX_STORY_LOG_ENTRIES);
    expect(history[0]).toMatchObject({ actionIndex: 1 });
  });
});

describe('selectRouteHistoryForChapter', () => {
  it('isolates new chapter-scoped choices while retaining legacy save entries', () => {
    const entries: RouteHistoryEntry[] = [
      { kind: 'choice', key: 'legacy', value: 'A', sceneId: 'hub', actionIndex: 1 },
      {
        kind: 'choice',
        key: 'chapter-a',
        value: 'B',
        chapterPath: 'routes/a/1.yaml',
        sceneId: 'hub',
        actionIndex: 1,
      },
      {
        kind: 'choice',
        key: 'chapter-b',
        value: 'C',
        chapterPath: 'routes/b/1.yaml',
        sceneId: 'hub',
        actionIndex: 1,
      },
    ];

    expect(selectRouteHistoryForChapter(entries, 'routes/a/1.yaml').map((entry) => entry.key)).toEqual([
      'legacy',
      'chapter-a',
    ]);
  });
});
