import { useEffect, useMemo, useRef, useState } from 'react';
import { getStoryMap, replayStoryMapNode } from './engine';
import { layoutStoryMap, visibleStoryChapter, type StoryMapData } from './storyMap';
import { trapGameDialogFocus } from './gameInterface';
import './storyMap.css';

const kindLabel = { scene: '이야기', choice: '갈림길', input: '단서', death: '멈춘 운명', ending: '결말' };
type Props = { onClose: () => void; onReplayed: () => void; onRecords: () => void; outcome?: string; ending?: boolean };
export function StoryMap({ onClose, onReplayed, onRecords, outcome, ending }: Props) {
  const [data, setData] = useState<StoryMapData>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [chapterPath, setChapterPath] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [zoom, setZoom] = useState(.85);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
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
    }).catch(() => { if (!cancelled) setError('이야기 지도를 불러오지 못했습니다. 다시 시도해 주세요.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  const chapter = data?.chapters.find(c => c.path === chapterPath);
  const visible = useMemo(() => chapter && data ? visibleStoryChapter(chapter, data.visits, data.travelled, data.choices)
    : { nodes: [], edges: [] }, [chapter, data]);
  const positioned = useMemo(() => layoutStoryMap(visible.nodes, visible.edges, chapter?.entry), [visible, chapter?.entry]);
  const positions = useMemo(() => new Map(positioned.map(n => [n.id, n])), [positioned]);
  const selected = visible.nodes.find(n => n.id === selectedId);
  const seen = new Set(data?.visits.map(v => v.id));
  const width = Math.max(700, ...positioned.map(n => n.x + 260));
  const height = Math.max(360, ...positioned.map(n => n.y + 220));
  const focusNode = (id: string | undefined) => {
    const node = id ? positions.get(id) : undefined;
    if (!node || !viewport.current) return;
    viewport.current.scrollTo({ left: (node.x + 100) * zoom - viewport.current.clientWidth / 2,
      top: (node.y + 70) * zoom - viewport.current.clientHeight / 2, behavior: 'smooth' });
  };
  useEffect(() => {
    focusNode(selectedId);
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => focusNode(selectedId));
    observer.observe(element);
    return () => observer.disconnect();
  }, [chapterPath, selectedId, zoom, data, positions]);
  const replay = async () => {
    if (!selected || busy) return;
    setBusy(true); setNotice('이 지점의 이야기를 펼치는 중…');
    try {
      if (await replayStoryMapNode(selected.id)) onReplayed();
      else setNotice('이 지점의 저장을 복원하지 못했습니다. 다른 지점을 선택해 주세요.');
    } catch { setNotice('이야기를 불러오지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  return <section className="story-atlas" role="dialog" aria-modal="true" aria-labelledby="story-atlas-title"
    onClick={e => e.stopPropagation()} onKeyDown={e => {
      e.stopPropagation(); trapGameDialogFocus(e);
      if (e.key === 'Escape' && !busy) onClose();
    }}>
    <header className="story-atlas-header">
      <div><span className="story-atlas-eyebrow">THE PATH YOU HAVE WRITTEN</span><h2 id="story-atlas-title">이야기 지도</h2></div>
      <p>{outcome ? <><b>{outcome}</b><span>끝난 자리에서, 다른 운명을 펼쳐 보세요.</span></> : '처음의 선택부터, 지금 당신이 서 있는 곳까지.'}</p>
      <button ref={closeRef} type="button" onClick={onClose} disabled={busy} aria-label="이야기 지도 닫기">닫기 ×</button>
    </header>
    {loading ? <div className="story-atlas-empty" role="status">이야기의 가지를 펼치고 있습니다…</div>
      : error ? <div className="story-atlas-empty" role="alert">{error}<button onClick={() => setRevision(r => r + 1)}>다시 불러오기</button></div>
      : <>
        <nav className="story-atlas-chapters" aria-label="전체 챕터">
          {data?.chapters.map(c => {
            const count = c.nodes.filter(n => n.chapter === c.path && seen.has(n.id)).length;
            return <button key={c.path} type="button" className={c.path === chapterPath ? 'is-active' : ''}
              aria-current={c.path === chapterPath ? 'step' : undefined} disabled={!count && !c.error}
              onClick={() => { setChapterPath(c.path); setSelectedId(c.nodes.find(n => seen.has(n.id))?.id ?? ''); setNotice(''); }}>
              <small>CHAPTER {String(c.number).padStart(2, '0')}</small>
              <strong>{count ? c.title ?? `제${c.number}장 · 지나온 이야기` : c.error ? '불러오기 실패' : '아직 닿지 않은 장'}</strong>
              <span>{count ? `${count}개의 장면 발견` : c.error ? '다시 시도할 수 있어요' : '잠김'}</span>
            </button>;
          })}
        </nav>
        <div className="story-atlas-body">
          <div className="story-atlas-map-area">
            <div className="story-atlas-toolbar"><span><i /> 지나온 길 <i className="is-locked" /> 미지의 갈림길</span>
              <div><button aria-label="지도 축소" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, z - .15))}>−</button>
                <output aria-label="지도 배율">{Math.round(zoom * 100)}%</output>
                <button aria-label="지도 확대" disabled={zoom >= 1.3} onClick={() => setZoom(z => Math.min(1.3, z + .15))}>＋</button>
                <button onClick={() => { const c = data?.chapters.find(c => c.nodes.some(n => n.id === data.current && n.chapter === c.path));
                  if (c) { setChapterPath(c.path); setSelectedId(data?.current ?? ''); focusNode(data?.current); } }}>현재 위치</button></div>
            </div>
            <div className="story-atlas-viewport" ref={viewport} tabIndex={0} aria-label="분기 지도. 스크롤하거나 빈 곳을 드래그해 이동하세요."
              onPointerDown={e => {
                if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest('button')) return;
                drag.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop };
                e.currentTarget.setPointerCapture(e.pointerId);
              }} onPointerMove={e => { if (drag.current) { e.currentTarget.scrollLeft = drag.current.left - e.clientX + drag.current.x;
                e.currentTarget.scrollTop = drag.current.top - e.clientY + drag.current.y; } }}
              onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
              {chapter?.error ? <div className="story-atlas-empty">{chapter.error}<button onClick={() => setRevision(r => r + 1)}>다시 불러오기</button></div>
                : <div style={{ width: width * zoom, height: height * zoom }}>
                  <div className="story-atlas-canvas" style={{ width, height, transform: `scale(${zoom})` }}>
                    <svg width={width} height={height} aria-hidden="true">
                      {visible.edges.map((edge, i) => {
                        const a = positions.get(edge.from)!; const b = positions.get(edge.to)!;
                        const x = a.x + 204; const y = a.y + 62; const endX = b.x; const endY = b.y + 62;
                        return <path key={i} className={edge.taken ? 'is-travelled' : ''}
                          d={`M ${x} ${y} C ${x + 42} ${y}, ${endX - 42} ${endY}, ${endX} ${endY}`} />;
                      })}
                    </svg>
                    {positioned.map(node => {
                      const unlocked = seen.has(node.id);
                      const current = node.id === data?.current;
                      return <button type="button" key={node.id} className={`story-atlas-node ${unlocked ? 'is-unlocked' : 'is-locked'} ${current ? 'is-current' : ''} ${node.id === selectedId ? 'is-selected' : ''}`}
                        style={{ left: node.x, top: node.y }} disabled={!unlocked} aria-pressed={node.id === selectedId}
                        aria-label={unlocked ? `${kindLabel[node.kind]}: ${node.title}${current ? ', 현재 위치' : ''}` : '아직 펼치지 않은 이야기'}
                        onClick={() => { if (node.chapter !== chapterPath) setChapterPath(node.chapter); setSelectedId(node.id); setNotice(''); }}>
                        <div className="story-atlas-node-art">{node.image && <img src={node.image} alt="" loading="lazy" />}
                          {node.portrait && <img className="story-atlas-portrait" src={node.portrait} alt="" loading="lazy" />}
                          <span>{unlocked ? kindLabel[node.kind] : '미발견'}</span>{current && <b>현재 위치</b>}
                          {!unlocked && <em aria-hidden="true">◇</em>}</div>
                        <strong>{node.title}</strong>
                      </button>;
                    })}
                  </div>
                </div>}
            </div>
            <footer className="story-atlas-map-footer"><span>가지를 따라, 아직 만나지 못한 운명으로.</span><span>드래그 · 스크롤로 이동</span></footer>
          </div>
          <aside className="story-atlas-detail" aria-label="선택한 이야기">
            {selected?.unlocked ? <>
              {selected.image && <img className="story-atlas-detail-image" src={selected.image} alt="" />}
              <div className="story-atlas-detail-copy"><small>CHAPTER {String(chapter?.number ?? 1).padStart(2, '0')} · {kindLabel[selected.kind]}</small>
                <h3>{selected.title}</h3>
                {visible.edges.filter(e => e.from === selected.id && e.taken && e.label).map((edge, i) => <p className="story-atlas-choice" key={i}>선택한 길 · {edge.label}</p>)}
                <p>{data?.visits.find(v => v.id === selected.id)?.replayable ? '플레이 도중에도 언제든 돌아갈 수 있습니다. 그때의 소지품과 관계로 다시 이어집니다.'
                  : '발견한 이야기입니다. 다시 이어갈 수 있는 앞선 장면을 선택해 주세요.'}</p>
                <button className="story-atlas-replay" disabled={busy || !data?.visits.find(v => v.id === selected.id)?.replayable}
                  onClick={() => void replay()}>{busy ? '이야기를 펼치는 중…' : '이 시점으로 돌아가기'} <span>→</span></button>
              </div>
            </> : <div className="story-atlas-detail-copy"><small>YOUR STORY</small><h3>어떤 길을 걸어왔나요?</h3><p>밝혀진 장면을 선택해 이야기를 돌아보세요. 앞으로 만날 장면은 아직 비밀입니다.</p></div>}
            <div className="story-atlas-detail-bottom"><p role="status">{notice}</p>
              {!data?.persistent && <p>탐색 기록은 현재 세션에만 보관됩니다. 자동 저장과 브라우저 저장 공간을 확인해 주세요.</p>}
              <button onClick={onRecords} disabled={busy}>{ending ? '엔딩 기록 · 크레딧' : '저장과 복구'}</button></div>
          </aside>
        </div>
      </>}
  </section>;
}
