import type { Action, GameData } from './types';

export type StoryMapNode = {
  id: string; chapter: string; scene: string; action: number;
  kind: 'scene' | 'choice' | 'input' | 'death' | 'ending';
  title: string; image?: string; portrait?: string;
};
export type StoryMapEdge = { from: string; to: string; label?: string; option?: number };
export type StoryMapChapter = { path: string; number: number; title?: string; entry?: string; nodes: StoryMapNode[]; edges: StoryMapEdge[]; error?: string };
export type StoryMapVisit = { id: string; replayable: boolean };
export type StoryMapData = {
  chapters: StoryMapChapter[]; visits: StoryMapVisit[]; travelled: string[];
  choices?: Record<string, string[]>; current?: string; persistent: boolean;
};
export const storyNodeId = (chapter: string, scene: string, action: number) => JSON.stringify([chapter, scene, action]);
export const storyEdgeId = (from: string, to: string) => JSON.stringify([from, to]);
export const isMapStop = (action: Action | undefined, index: number, previous?: Action) => index === 0
  || Boolean(previous && ('choice' in previous || 'input' in previous)) || Boolean(action &&
  ('choice' in action || 'input' in action || 'gameOver' in action || 'ending' in action));

/** Reads authored control flow, never evaluates conditions or executes an action. */
export function buildStoryChapter(game: GameData, path: string, number: number, resolve: (path: string) => string,
  nextChapter?: string): StoryMapChapter {
  const nodes: StoryMapNode[] = [];
  const edges: StoryMapEdge[] = [];
  const target = (value: string) => /^[./]/.test(value)
    ? `chapter:./${value.replace(/^(\.\/|\/)+/, '')}${/\.ya?ml$/i.test(value) ? '' : '.yaml'}`
    : storyNodeId(path, value, 0);
  for (const [scene, definition] of Object.entries(game.scenes)) {
    const actions = definition.actions;
    const stops = actions.map((a, i) => isMapStop(a, i, actions[i - 1]) ? i : -1).filter(i => i >= 0);
    if (!stops.length) stops.push(0);
    let background: string | undefined;
    let portrait: string | undefined;
    for (let s = 0; s < stops.length; s++) {
      const start = stops[s];
      const end = stops[s + 1] ?? actions.length;
      const slice = actions.slice(start, end);
      const first = actions[start];
      for (const a of slice) {
        if ('bg' in a) background = game.assets.backgrounds[typeof a.bg === 'string' ? a.bg : a.bg.id];
        if ('char' in a) {
          const character = game.assets.characters[a.char.id];
          if (character) portrait = character.emotions?.[a.char.emotion ?? ''] ?? character.base;
        }
      }
      const kind = first && 'choice' in first ? 'choice' : first && 'input' in first ? 'input'
        : first && 'gameOver' in first ? 'death' : first && 'ending' in first ? 'ending' : 'scene';
      const say = slice.find((a): a is Extract<Action, {say: unknown}> => 'say' in a);
      const title = s === 0 && definition.title ? definition.title : first && 'choice' in first ? first.choice.prompt : first && 'input' in first ? first.input.prompt
        : first && 'gameOver' in first ? first.gameOver.title ?? '멈춘 이야기'
        : first && 'ending' in first ? game.endings?.[first.ending]?.title ?? '이야기의 결말'
        : say?.say.text ?? (s === 0 ? '이야기의 시작' : '이어지는 이야기');
      const id = storyNodeId(path, scene, start);
      nodes.push({ id, chapter: path, scene, action: start, kind, title,
        image: background ? resolve(background) : undefined,
        portrait: portrait && !/\.json(?:\?|$)/i.test(portrait) ? resolve(portrait) : undefined });
      const scriptIndex = game.script.findIndex(entry => entry.scene === scene);
      const nextScene = game.script[scriptIndex + 1]?.scene;
      const continuation = stops[s + 1] !== undefined ? storyNodeId(path, scene, stops[s + 1])
        : nextScene ? storyNodeId(path, nextScene, 0) : nextChapter ? `chapter:${nextChapter}` : undefined;
      let continues = true;
      const add = (to: string | undefined, label?: string, option?: number) => { if (to) edges.push({ from: id, to, label, ...(option === undefined ? {} : { option }) }); };
      for (const a of slice) {
        if ('goto' in a) { add(target(a.goto)); continues = false; break; }
        if ('gameOver' in a || 'ending' in a) { continues = false; break; }
        if ('branch' in a) {
          a.branch.cases.forEach(c => add(target(c.goto)));
          if (a.branch.default) { add(target(a.branch.default)); continues = false; break; }
        }
        if ('input' in a) a.input.routes?.forEach(r => { if (r.goto) add(target(r.goto)); });
        if ('choice' in a) {
          a.choice.options.forEach((option, index) => {
            if (option.gameOver) {
              const deathId = `${id}:death:${index}`;
              nodes.push({ id: deathId, chapter: path, scene, action: start, kind: 'death',
                title: option.gameOver.title ?? '멈춘 이야기', image: background ? resolve(background) : undefined });
              add(deathId, option.text, index + 1);
            } else add(option.goto ? target(option.goto) : continuation, option.text, index + 1);
          });
          continues = false; break;
        }
      }
      if (continues) add(continuation);
    }
  }
  return { path, number, title: game.chapterTitle, entry: storyNodeId(path, game.script[0].scene, 0), nodes, edges };
}

export function visibleStoryChapter(chapter: StoryMapChapter, visits: StoryMapVisit[], travelled: string[], choices: Record<string, string[]> = {}) {
  const seen = new Set(visits.map(v => v.id));
  const taken = new Set(travelled);
  const frontier = new Set(chapter.edges.filter(e => seen.has(e.from)).map(e => e.to));
  const nodes = chapter.nodes.filter(n => seen.has(n.id) || frontier.has(n.id)).map(n => seen.has(n.id)
    ? { ...n, unlocked: true }
    : { ...n, title: '아직 펼치지 않은 이야기', image: undefined, portrait: undefined, kind: 'scene' as const, unlocked: false });
  const ids = new Set(nodes.map(n => n.id));
  const edges = chapter.edges.filter(e => ids.has(e.from) && ids.has(e.to)).map(e => ({
    ...e, label: taken.has(storyEdgeId(e.from, e.to)) && (!e.label || choices[e.from]?.includes(e.label)) ? e.label : undefined,
    taken: taken.has(storyEdgeId(e.from, e.to)) && (!e.label || Boolean(choices[e.from]?.includes(e.label))),
  }));
  return { nodes, edges };
}

/** Remove DFS back edges, then place merges after every forward predecessor. */
export function layoutStoryMap(nodes: StoryMapNode[], edges: StoryMapEdge[], entry?: string) {
  const ids = new Set(nodes.map(n => n.id));
  const outgoing = new Map(nodes.map(n => [n.id, edges.filter(e => e.from === n.id && ids.has(e.to))]));
  const visited = new Set<string>();
  const active = new Set<string>();
  const returns = new Set<StoryMapEdge>();
  const order: string[] = [];
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    for (const edge of outgoing.get(id) ?? []) {
      if (active.has(edge.to)) returns.add(edge);
      else visit(edge.to);
    }
    active.delete(id); order.push(id);
  };
  if (entry && ids.has(entry)) visit(entry);
  nodes.forEach(n => visit(n.id));
  const rank = new Map(nodes.map(n => [n.id, 0]));
  for (const id of order.reverse()) for (const edge of outgoing.get(id) ?? []) {
    if (!returns.has(edge)) rank.set(edge.to, Math.max(rank.get(edge.to)!, rank.get(id)! + 1));
  }
  const routed = edges.filter(e => ids.has(e.from) && ids.has(e.to)
    && (rank.get(e.to)! <= rank.get(e.from)! || rank.get(e.to)! > rank.get(e.from)! + 1));
  const rows = new Map<number, number>();
  return nodes.map(node => {
    const column = rank.get(node.id) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { ...node, x: 64 + column * 320, y: 80 + routed.length * 24 + row * 208 };
  });
}

/** Each option gets a separate port and arrow, including identical destinations and self loops. */
export function routeStoryMapEdges<E extends StoryMapEdge>(nodes: ReturnType<typeof layoutStoryMap>, edges: E[]) {
  const positions = new Map(nodes.map(n => [n.id, n]));
  let lane = 0;
  return edges.filter(edge => positions.has(edge.from) && positions.has(edge.to)).map(edge => {
    const a = positions.get(edge.from)!; const b = positions.get(edge.to)!;
    const siblings = edges.filter(e => e.from === edge.from);
    const index = siblings.indexOf(edge);
    const y = a.y + 28 + (index + 1) * 92 / (siblings.length + 1);
    const x = a.x + 204;
    const endY = b.y + 28 + (index + 1) * 92 / (siblings.length + 1);
    const returning = b.x <= a.x;
    const outside = returning || b.x > a.x + 320;
    if (outside) {
      const top = 24 + lane++ * 24;
      const exitX = x + 28 + index * 8;
      const enterX = b.x - 28 - index * 8;
      return { ...edge, returning, labelX: (exitX + enterX) / 2, labelY: top - 5,
        path: `M ${x} ${y} H ${exitX} V ${top} H ${enterX} V ${endY} H ${b.x - 4}` };
    }
    return { ...edge, returning, labelX: x + 52, labelY: y - 7,
      path: `M ${x} ${y} C ${x + 56} ${y}, ${b.x - 56} ${endY}, ${b.x - 4} ${endY}` };
  });
}

/** Summarize only revealed, unambiguous continuations. A shared destination need not mean equal state. */
export function describeStoryRoute(edge: StoryMapEdge, nodes: Array<StoryMapNode & { unlocked: boolean }>, edges: StoryMapEdge[], entry?: string) {
  const positions = new Map(layoutStoryMap(nodes, edges, entry).map(n => [n.id, n]));
  const byId = new Map(nodes.map(n => [n.id, n]));
  let destination = byId.get(edge.to);
  let from = edge.from;
  let returning = false;
  const seen = new Set<string>();
  while (destination?.unlocked && !seen.has(destination.id)) {
    returning ||= (positions.get(destination.id)?.x ?? 0) <= (positions.get(from)?.x ?? 0);
    if (destination.kind !== 'scene') break;
    seen.add(destination.id);
    const next = edges.filter(e => e.from === destination!.id);
    if (next.length !== 1) break;
    // Keep the last revealed scene as the destination instead of exposing the future.
    const target = byId.get(next[0].to);
    if (!target?.unlocked) break;
    from = destination.id; destination = target;
  }
  if (!destination?.unlocked) return '아직 확인하지 않은 길';
  const prefix = destination.kind === 'death' ? '죽음' : destination.kind === 'ending' ? '결말'
    : returning ? '앞선 지점으로 돌아감' : '다음 지점으로 진행';
  return `${prefix} · ${destination.title}`;
}
