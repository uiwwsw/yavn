import { t, uiLanguage } from './uiLanguage';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getStoryMap, replayStoryMapNode } from './engine';
import { describeStoryRoute, layoutStoryMap, routeStoryMapEdges, visibleStoryChapter, type StoryMapData } from './storyMap';
import { trapGameDialogFocus } from './gameInterface';
import './storyMap.css';

const kindLabel = { scene: t("이야기"), choice: t("갈림길"), input: t("단서"), death: t("멈춘 운명"), ending: t("결말") };
type Props = { onClose: () => void; onReplayed: () => void; onRecords: () => void; outcome?: string; ending?: boolean };
export function StoryMap({ onClose, onReplayed, onRecords, outcome, ending }: Props) {
  const [data, setData] = useState<StoryMapData>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [chapterPath, setChapterPath] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [zoom, setZoom] = useState(.85);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const chapterNav = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number }>();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getStoryMap().then(result => {
      if (cancelled) return;
      setData(result);
      const current = result.chapters.find(c => c.nodes.some(n => n.id === result.current && n.chapter === c.path));
      setChapterPath(current?.path ?? result.chapters[0]?.path ?? '');
      setSelectedId(result.current ?? '');
    }).catch(() => { if (!cancelled) setError(t("이야기 지도를 불러오지 못했습니다. 다시 시도해 주세요.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  const chapter = data?.chapters.find(c => c.path === chapterPath);
  const visible = useMemo(() => chapter && data ? visibleStoryChapter(chapter, data.visits, data.travelled, data.choices)
    : { nodes: [], edges: [] }, [chapter, data]);
  const positioned = useMemo(() => layoutStoryMap(visible.nodes, visible.edges, chapter?.entry), [visible, chapter?.entry]);
  const positions = useMemo(() => new Map(positioned.map(n => [n.id, n])), [positioned]);
  const routed = useMemo(() => routeStoryMapEdges(positioned, visible.edges), [positioned, visible.edges]);
  const selected = visible.nodes.find(n => n.id === selectedId);
  const seen = new Set(data?.visits.map(v => v.id));
  const width = Math.max(700, ...positioned.map(n => n.x + 260));
  const height = Math.max(360, ...positioned.map(n => n.y + 220));
  // Leave a full screen of empty map beyond every edge so the story can be
  // panned freely, including above the first row and to the left of the start.
  const mapMargin = { x: Math.max(640, viewportSize.width), y: Math.max(480, viewportSize.height) };
  const focusNode = (id: string | undefined, behavior: ScrollBehavior = 'auto') => {
    const node = id ? positions.get(id) : undefined;
    if (!node || !viewport.current) return;
    viewport.current.scrollTo({
      left: mapMargin.x + (node.x + 102) * zoom - viewport.current.clientWidth / 2,
      top: mapMargin.y + (node.y + 74) * zoom - viewport.current.clientHeight / 2,
      behavior,
    });
  };
  // The viewport mounts only after loading. Measure it before focusing; React may
  // commit the data while the loading placeholder is still on screen.
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading]);
  useLayoutEffect(() => { focusNode(selectedId); }, [loading, chapterPath, selectedId, zoom, positions, viewportSize]);
  useEffect(() => { chapterNav.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [loading, chapterPath]);
  const replay = async () => {
    if (!selected || busy) return;
    setBusy(true); setNotice(t("이 지점의 이야기를 펼치는 중…"));
    try {
      if (await replayStoryMapNode(selected.id)) onReplayed();
      else setNotice(t("이 지점의 저장을 복원하지 못했습니다. 다른 지점을 선택해 주세요."));
    } catch { setNotice(t("이야기를 불러오지 못했습니다. 다시 시도해 주세요.")); }
    finally { setBusy(false); }
  };
  return <section className="story-atlas" role="dialog" aria-modal="true" aria-labelledby="story-atlas-title"
    onClick={e => e.stopPropagation()} onKeyDown={e => {
      e.stopPropagation(); trapGameDialogFocus(e);
      if (e.key === 'Escape' && !busy) onClose();
    }}>
    <header className="story-atlas-header">
      <div><span className="story-atlas-eyebrow">THE PATH YOU HAVE WRITTEN</span><h2 id="story-atlas-title">{t("이야기 지도")}</h2></div>
      <p>{outcome ? <><b>{outcome}</b><span>{t("끝난 자리에서, 다른 운명을 펼쳐 보세요.")}</span></> : t("처음의 선택부터, 지금 당신이 서 있는 곳까지.")}</p>
      <button ref={closeRef} type="button" onClick={onClose} disabled={busy} aria-label={t("이야기 지도 닫기")}>{t("닫기 ×")}</button>
    </header>
    {loading ? <div className="story-atlas-empty" role="status">{t("이야기의 가지를 펼치고 있습니다…")}</div>
      : error ? <div className="story-atlas-empty" role="alert">{error}<button onClick={() => setRevision(r => r + 1)}>{t("다시 불러오기")}</button></div>
      : <>
        <nav ref={chapterNav} className="story-atlas-chapters" aria-label={t("전체 챕터")}>
          {data?.chapters.map(c => {
            const count = c.nodes.filter(n => n.chapter === c.path && seen.has(n.id)).length;
            return <button key={c.path} type="button" className={c.path === chapterPath ? 'is-active' : ''}
              aria-current={c.path === chapterPath ? 'step' : undefined} disabled={!count && !c.error}
              onClick={() => { setChapterPath(c.path); setSelectedId(c.nodes.find(n => seen.has(n.id))?.id ?? ''); setNotice(''); }}>
              <small>CHAPTER {String(c.number).padStart(2, '0')}</small>
              <strong>{count ? c.title ?? uiLanguage === 'en' ? `Chapter ${c.number} · Your story` : `제${c.number}장 · 지나온 이야기` : c.error ? t("불러오기 실패") : t("아직 닿지 않은 장")}</strong>
              <span>{count ? uiLanguage === 'en' ? `${count} scenes discovered` : `${count}개의 장면 발견` : c.error ? t("다시 시도할 수 있어요") : t("잠김")}</span>
            </button>;
          })}
        </nav>
        <div className="story-atlas-body">
          <div className="story-atlas-map-area">
            <div className="story-atlas-toolbar"><span><i />{t("지나온 길")}<i className="is-locked" />{t("미지의 갈림길")}</span>
              <div><button aria-label={t("지도 축소")} disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, z - .15))}>−</button>
                <output aria-label={t("지도 배율")}>{Math.round(zoom * 100)}%</output>
                <button aria-label={t("지도 확대")} disabled={zoom >= 1.3} onClick={() => setZoom(z => Math.min(1.3, z + .15))}>＋</button>
                <button onClick={() => { const c = data?.chapters.find(c => c.nodes.some(n => n.id === data.current && n.chapter === c.path));
                  if (c) { setChapterPath(c.path); setSelectedId(data?.current ?? ''); focusNode(data?.current, 'smooth'); } }}>{t("현재 위치")}</button></div>
            </div>
            <div className="story-atlas-viewport" ref={viewport} tabIndex={0} aria-label={t("분기 지도. 스크롤하거나 빈 곳을 드래그해 이동하세요.")}
              onPointerDown={e => {
                if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest('button')) return;
                drag.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop };
                e.currentTarget.setPointerCapture(e.pointerId);
              }} onPointerMove={e => { if (drag.current) { e.currentTarget.scrollLeft = drag.current.left - e.clientX + drag.current.x;
                e.currentTarget.scrollTop = drag.current.top - e.clientY + drag.current.y; } }}
              onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
              {chapter?.error ? <div className="story-atlas-empty">{chapter.error}<button onClick={() => setRevision(r => r + 1)}>{t("다시 불러오기")}</button></div>
                : <div style={{ width: width * zoom + mapMargin.x * 2, height: height * zoom + mapMargin.y * 2, position: 'relative' }}>
                  <div className="story-atlas-canvas" style={{ width, height, left: mapMargin.x, top: mapMargin.y, transform: `scale(${zoom})` }}>
                    <svg width={width} height={height} aria-hidden="true">
                      <defs>
                        <marker id="story-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><polygon points="0,0 10,5 0,10" fill="#71847c" /></marker>
                        <marker id="story-arrow-taken" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><polygon points="0,0 10,5 0,10" fill="#dfbd7d" /></marker>
                      </defs>
                      {routed.map((edge, i) => <g key={i}>
                        <path className={edge.taken ? 'is-travelled' : ''} d={edge.path}
                          markerEnd={`url(#story-arrow${edge.taken ? '-taken' : ''})`} />
                        {(edge.option || edge.returning) && <text className={edge.taken ? 'is-travelled' : ''}
                          x={edge.labelX} y={edge.labelY} textAnchor="middle">
                          {edge.option ? uiLanguage === 'en' ? `${edge.option}` : `${edge.option}번` : ''}{edge.returning ? t(" ↶ 돌아감") : ''}
                        </text>}
                      </g>)}
                    </svg>
                    {positioned.map(node => {
                      const unlocked = seen.has(node.id);
                      const current = node.id === data?.current;
                      return <button type="button" key={node.id} className={`story-atlas-node ${unlocked ? 'is-unlocked' : 'is-locked'} ${current ? 'is-current' : ''} ${node.id === selectedId ? 'is-selected' : ''}`}
                        style={{ left: node.x, top: node.y }} disabled={!unlocked} aria-pressed={node.id === selectedId}
                        aria-label={unlocked ? `${kindLabel[node.kind]}: ${node.title}${current ? t(", 현재 위치") : ''}` : t("아직 펼치지 않은 이야기")}
                        onClick={() => { if (node.chapter !== chapterPath) setChapterPath(node.chapter); setSelectedId(node.id); setNotice(''); }}>
                        <div className="story-atlas-node-art">{node.image && <img src={node.image} alt="" loading="lazy" />}
                          {node.portrait && <img className="story-atlas-portrait" src={node.portrait} alt="" loading="lazy" />}
                          <span>{unlocked ? kindLabel[node.kind] : t("미발견")}</span>{current && <b>{t("현재 위치")}</b>}
                          {!unlocked && <em aria-hidden="true">◇</em>}</div>
                        <strong>{node.title}</strong>
                      </button>;
                    })}
                  </div>
                </div>}
            </div>
            <footer className="story-atlas-map-footer"><span>{t("화살표는 진행 방향 · ↶는 앞선 지점으로 돌아가는 길")}</span><span>{t("드래그 · 스크롤로 이동")}</span></footer>
          </div>
          <aside className="story-atlas-detail" aria-label={t("선택한 이야기")}>
            {selected?.unlocked ? <>
              {selected.image && <img className="story-atlas-detail-image" src={selected.image} alt="" />}
              <div className="story-atlas-detail-copy"><small>CHAPTER {String(chapter?.number ?? 1).padStart(2, '0')} · {kindLabel[selected.kind]}</small>
                <h3>{selected.title}</h3>
                {visible.edges.filter(e => e.from === selected.id).map((edge, i, siblings) => <div className="story-atlas-choice" key={i}>
                  <strong>{edge.option ? uiLanguage === 'en' ? `Choice ${edge.option}` : `${edge.option}번 선택` : t("이어지는 길")} · {edge.taken ? edge.label ?? t("지나온 길") : t("미탐색")}</strong>
                  <p>{edge.taken || !edge.option ? describeStoryRoute(edge, visible.nodes, visible.edges, chapter?.entry) : t("아직 확인하지 않은 길")}</p>
                  {edge.taken && siblings.filter(e => e.to === edge.to && e.taken).length > 1 && <small>{t("같은 장면에 합류 · 선택에 따른 관계와 소지품은 다를 수 있습니다.")}</small>}
                </div>)}
                <p>{data?.visits.find(v => v.id === selected.id)?.replayable ? t("플레이 도중에도 언제든 돌아갈 수 있습니다. 그때의 소지품과 관계로 다시 이어집니다.")
                  : t("발견한 이야기입니다. 다시 이어갈 수 있는 앞선 장면을 선택해 주세요.")}</p>
                <button className="story-atlas-replay" disabled={busy || !data?.visits.find(v => v.id === selected.id)?.replayable}
                  onClick={() => void replay()}>{busy ? t("이야기를 펼치는 중…") : t("이 시점으로 돌아가기")} <span>→</span></button>
              </div>
            </> : <div className="story-atlas-detail-copy"><small>YOUR STORY</small><h3>{t("어떤 길을 걸어왔나요?")}</h3><p>{t("밝혀진 장면을 선택해 이야기를 돌아보세요. 앞으로 만날 장면은 아직 비밀입니다.")}</p></div>}
            <div className="story-atlas-detail-bottom"><p role="status">{notice}</p>
              {!data?.persistent && <p>{t("탐색 기록은 현재 세션에만 보관됩니다. 자동 저장과 브라우저 저장 공간을 확인해 주세요.")}</p>}
              <button onClick={onRecords} disabled={busy}>{ending ? t("엔딩 기록 · 크레딧") : t("저장과 복구")}</button></div>
          </aside>
        </div>
      </>}
  </section>;
}
