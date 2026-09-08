import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { waitForImageReady } from './imageReady';
import { ResourceImage } from './ResourceImage';
import { createTitleParticles, DEFAULT_START_SCENE } from './startScene';
import type { StartSceneConfig, StartSceneLayer } from './types';

export function useSceneMotion(paused: boolean) {
  const [allowed, setAllowed] = useState(() => !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAllowed(!media.matches && !document.hidden);
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return allowed && !paused;
}

function PreparedSceneImage({ source, className, style }: { source: string; className: string; style?: CSSProperties }) {
  const ref = useRef<HTMLImageElement>(null);
  const [readySource, setReadySource] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    const image = ref.current;
    if (image) void waitForImageReady(image, 12000).then((status) => {
      if (!cancelled && status === 'ready') setReadySource(source);
    });
    return () => { cancelled = true; };
  }, [source]);
  return <ResourceImage ref={ref} className={`title-scene-image ${className}`} src={source} style={style}
    data-ready={readySource === source} alt="" aria-hidden="true" decoding="async" draggable={false} />;
}

function layerStyle(layer: StartSceneLayer): CSSProperties {
  return {
    '--layer-x': `${layer.x}%`, '--layer-y': `${layer.y}%`,
    '--layer-width': `${layer.width}%`, '--layer-height': `${layer.height}%`,
    '--layer-mobile-x': `${layer.mobile?.x ?? layer.x}%`, '--layer-mobile-y': `${layer.mobile?.y ?? layer.y}%`,
    '--layer-mobile-width': `${layer.mobile?.width ?? layer.width}%`,
    '--layer-mobile-height': `${layer.mobile?.height ?? layer.height}%`,
    '--layer-opacity': layer.opacity, '--layer-mobile-opacity': layer.mobile?.opacity ?? layer.opacity,
    '--layer-depth': layer.depth, mixBlendMode: layer.blend,
  } as CSSProperties;
}

const TitleParticles = memo(function TitleParticles({ scene, active }: { scene: StartSceneConfig; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0, height = 0, frame = 0, last = 0;
    const count = Math.round((window.innerWidth < 768 ? 54 : 92) * scene.intensity);
    const particles = createTitleParticles(count);
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const draw = (now: number) => {
      if (last) timeRef.current += Math.min(now - last, 40) / 1000;
      last = now;
      const time = timeRef.current;
      ctx.clearRect(0, 0, width, height);
      const rain = scene.particles === 'rain';
      const snow = scene.particles === 'snow';
      const embers = scene.particles === 'embers';
      const flies = scene.particles === 'fireflies';
      ctx.fillStyle = scene.accent ?? (embers ? '#ffc17b' : flies ? '#d9e8a1' : '#e3e5ed');
      ctx.strokeStyle = scene.accent ?? '#b4c8df';
      for (const p of particles) {
        const speed = p.speed * (rain ? 6 : snow ? .7 : .33);
        const progress = ((p.y + time * speed) % 1 + 1) % 1;
        const x = (p.x * (width + 80) + Math.sin(time * .4 + p.phase) * (rain ? 4 : 30)) - 40;
        const y = (rain || snow ? progress : 1 - progress) * (height + 70) - 35;
        const envelope = Math.sin(progress * Math.PI);
        ctx.globalAlpha = (rain ? .2 : .25 + .5 * p.depth) * envelope * (flies ? .4 + .6 * Math.pow(Math.sin(time + p.phase), 2) : 1);
        if (rain) {
          ctx.lineWidth = .5 + p.depth;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8 * p.depth, y + 22 * p.depth); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.ellipse(x, y, p.size * (embers ? .6 : 1), p.size * (embers ? 1.6 : 1), -.3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    if (active && scene.particles !== 'none' && count > 0) frame = requestAnimationFrame(draw);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height); };
  }, [scene.accent, scene.intensity, scene.particles, active]);
  return <canvas ref={ref} className="title-scene-particles" aria-hidden="true" />;
});

export const TitleScene = memo(function TitleScene({ scene: configured, imageUrl, showTitle, paused }: {
  scene?: StartSceneConfig; imageUrl?: string; showTitle: boolean; paused: boolean;
}) {
  const scene = configured ?? DEFAULT_START_SCENE;
  const active = useSceneMotion(paused);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [readyVideoSource, setReadyVideoSource] = useState<string>();

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    if (active) void element.play().then(() => { if (!cancelled) setReadyVideoSource(scene.video); }).catch(() => { if (!cancelled) setReadyVideoSource(undefined); });
    else element.pause();
    return () => { cancelled = true; element.pause(); };
  }, [active, scene.video]);

  useEffect(() => {
    const element = root.current;
    const surface = element?.closest('.start-gate');
    if (!element || !surface) return;
    let frame = 0, x = 0, y = 0, targetX = 0, targetY = 0;
    const move = (event: Event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== 'mouse') return;
      const rect = surface.getBoundingClientRect();
      targetX = Math.max(-1, Math.min(1, (pointer.clientX - rect.left) / rect.width * 2 - 1)) * scene.parallax;
      targetY = Math.max(-1, Math.min(1, (pointer.clientY - rect.top) / rect.height * 2 - 1)) * scene.parallax * .6;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const leave = () => { targetX = 0; targetY = 0; if (!frame) frame = requestAnimationFrame(tick); };
    const tick = () => {
      x += (targetX - x) * .07; y += (targetY - y) * .07;
      element.style.setProperty('--scene-pointer-x', `${x.toFixed(2)}px`);
      element.style.setProperty('--scene-pointer-y', `${y.toFixed(2)}px`);
      frame = Math.abs(x - targetX) + Math.abs(y - targetY) > .05 ? requestAnimationFrame(tick) : 0;
    };
    if (active && scene.parallax > 0 && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      surface.addEventListener('pointermove', move); surface.addEventListener('pointerleave', leave);
    }
    return () => {
      cancelAnimationFrame(frame); surface.removeEventListener('pointermove', move); surface.removeEventListener('pointerleave', leave);
      element.style.setProperty('--scene-pointer-x', '0px'); element.style.setProperty('--scene-pointer-y', '0px');
    };
  }, [active, scene.parallax]);

  return (
    <div ref={root} className="title-scene" data-active={active} data-motion={scene.motion} data-light={scene.light}
      style={{ '--scene-duration': `${scene.duration}ms`, '--scene-intensity': scene.intensity,
        '--scene-accent': scene.accent ?? 'var(--start-gate-accent)' } as CSSProperties} aria-hidden="true">
      <div className="title-scene-parallax">
        <div className="title-scene-camera">
          {imageUrl && <PreparedSceneImage source={imageUrl} className="start-gate-bg-image" />}
          {scene.video && <video ref={video} className="title-scene-video" src={scene.video} muted loop playsInline preload="metadata"
            data-ready={readyVideoSource === scene.video} onError={() => setReadyVideoSource(undefined)} aria-hidden="true" />}
          {imageUrl && !showTitle && <PreparedSceneImage source={imageUrl} className="start-gate-title-art" />}
        </div>
      </div>
      {scene.layers.map((layer, index) => (
        <div key={`${index}-${layer.image}`} className="title-scene-depth" style={layerStyle(layer)}>
          <div className="title-scene-layer-position"><div className="title-scene-layer-motion" data-motion={layer.motion}>
            <PreparedSceneImage source={layer.image} className="title-scene-layer" style={{ objectFit: layer.fit }} />
          </div></div>
        </div>
      ))}
      <div className="title-scene-light" />
      {scene.fog && <div className="title-scene-fog"><i /><i /></div>}
      <TitleParticles scene={scene} active={active} />
    </div>
  );
});
