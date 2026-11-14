import { describe, expect, it } from 'vitest';
import { renderCreatePage } from './create-page.mjs';

describe('renderCreatePage', () => {
  const ko = renderCreatePage({ lang: 'ko', head: '<title>t</title>', fontUrl: '/assets/suite.woff2' });
  const en = renderCreatePage({ lang: 'en', head: '<title>t</title>', fontUrl: '/assets/suite.woff2' });

  it('declares the page language and carries the head it is given', () => {
    expect(ko).toContain('<html lang="ko">');
    expect(en).toContain('<html lang="en">');
    expect(ko).toContain('<title>t</title>');
  });

  it('points each language at the other one', () => {
    expect(ko).toContain('href="/en/create/"');
    expect(en).toContain('href="/create/"');
  });

  it('keeps the whole guide in the first response, with no app bundle', () => {
    for (const page of [ko, en]) {
      expect(page).not.toContain('<script');
      expect(page.match(/<li>/g) ?? []).toHaveLength(5);
    }
    expect(ko).toContain('저장소의 샘플 YAML로 시작합니다.');
    expect(en).toContain('Copy the sample YAML from the repository.');
  });

  it('states what YAVN is not, which is the part people get wrong', () => {
    expect(ko).toContain('타일맵이나 3D 전투 편집기는 아닙니다.');
    expect(en).toContain('It is not a tile-map or 3D combat engine.');
  });

  it('loads the site font rather than falling back to a system serif', () => {
    expect(ko).toContain('/assets/suite.woff2');
    expect(renderCreatePage({ lang: 'ko' })).not.toContain('@font-face');
  });
});
