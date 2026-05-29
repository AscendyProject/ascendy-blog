// 빌드타임 Mermaid 렌더링 (remark 플러그인).
//
// `​```mermaid` 코드펜스를 두 청중 모두에게 맞춰 변환한다:
//   - 사람(HTML): 빌드타임에 SVG로 렌더해 <figure>에 인라인 삽입 (클라이언트 JS 0).
//   - AI(HTML 직접 크롤): <details> 안에 Mermaid 원문을 병기.
//   - AI(llms-full.txt): 마크다운 본문(p.body)은 손대지 않으므로 원문 코드펜스가 그대로 덤프됨.
//
// remark(mdast) 단계에서 동작한다 — Astro의 Shiki 하이라이트는 rehype 단계라
// 그보다 먼저 mermaid `code` 노드를 빼낸다. 다른 코드 블록은 그대로 Shiki가 처리한다.
//
// 렌더는 mermaid-isomorphic(내부 Playwright)로 하고, 결과 SVG는
// `.mermaid-cache/<hash>.svg`에 캐시·커밋한다 → Cloudflare Pages 빌드는 캐시만
// 읽으므로 브라우저가 필요 없다. 캐시에 없는 다이어그램을 CF Pages에서 만나면
// 명확한 에러로 빌드를 멈춰 "로컬 렌더 후 캐시 커밋"을 강제한다.
//
// mermaid-isomorphic / playwright는 devDependency이고 cache-miss에서만 dynamic
// import하므로, 캐시 히트만 하는 CF Pages 빌드는 둘을 로드조차 하지 않는다.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visit } from 'unist-util-visit';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE_DIR = join(ROOT, '.mermaid-cache');
// 렌더 결과 포맷을 바꾸면 올려서 전체 캐시를 무효화한다.
const CACHE_VERSION = '1';
const MERMAID_OPTIONS = { theme: 'neutral' };

function cacheKey(source) {
  return createHash('sha256')
    .update(`${CACHE_VERSION}\n${JSON.stringify(MERMAID_OPTIONS)}\n${source}`)
    .digest('hex')
    .slice(0, 16);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function figureHtml(svg, source) {
  return (
    `<figure class="mermaid-diagram">${svg}` +
    `<details class="mermaid-source"><summary>Mermaid source</summary>` +
    `<pre><code>${escapeHtml(source)}</code></pre></details></figure>`
  );
}

export default function remarkMermaidFigure() {
  return async (tree) => {
    const targets = [];
    visit(tree, 'code', (node) => {
      if (node.lang === 'mermaid' && node.value.trim()) targets.push({ node, source: node.value });
    });
    if (targets.length === 0) return;

    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

    const misses = [];
    for (const t of targets) {
      t.cachePath = join(CACHE_DIR, `${cacheKey(t.source)}.svg`);
      if (existsSync(t.cachePath)) t.svg = readFileSync(t.cachePath, 'utf8');
      else misses.push(t);
    }

    if (misses.length > 0) {
      if (process.env.CF_PAGES) {
        throw new Error(
          `[mermaid] ${misses.length} diagram(s) missing from .mermaid-cache during a ` +
            `Cloudflare Pages build. Render locally (\`pnpm build\`) and commit ` +
            `.mermaid-cache/ — CI must not launch a browser.`,
        );
      }
      const { createMermaidRenderer } = await import('mermaid-isomorphic');
      const render = createMermaidRenderer();
      const results = await render(
        misses.map((m) => m.source),
        { mermaidOptions: MERMAID_OPTIONS },
      );
      misses.forEach((m, i) => {
        const r = results[i];
        const value =
          r && typeof r === 'object' && 'status' in r ? (r.status === 'fulfilled' ? r.value : null) : r;
        if (!value || !value.svg) {
          const reason = r && r.reason ? r.reason : 'unknown render error';
          throw new Error(`[mermaid] failed to render diagram:\n${m.source}\n→ ${reason}`);
        }
        m.svg = value.svg;
        writeFileSync(m.cachePath, m.svg, 'utf8');
      });
    }

    // mermaid code 노드를 raw HTML 노드로 변형한다 (트리 참조 유지).
    for (const t of targets) {
      t.node.type = 'html';
      t.node.value = figureHtml(t.svg, t.source);
      delete t.node.lang;
      delete t.node.meta;
    }
  };
}
