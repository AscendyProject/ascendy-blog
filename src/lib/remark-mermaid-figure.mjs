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
// 렌더 옵션을 바꾸면 캐시 키가 바뀌어 자동 재렌더된다.
// securityLevel:'strict' — mermaid가 라벨 콘텐츠를 새니타이즈한다(mermaid 기본이지만
// 보안 의존이라 명시). SVG의 능동 콘텐츠(script/핸들러/js-url)는 아래 sanitizeSvg가
// foreignObject 내부까지 전역으로 제거한다 — 위협은 컨테이너가 아니라 능동 콘텐츠다.
const CACHE_VERSION = '2';
const MERMAID_OPTIONS = { theme: 'neutral', securityLevel: 'strict' };

function cacheKey(source) {
  return createHash('sha256')
    .update(`${CACHE_VERSION}\n${JSON.stringify(MERMAID_OPTIONS)}\n${source}`)
    .digest('hex')
    .slice(0, 16);
}

// 빌드타임 SVG의 능동 콘텐츠를 제거한다. 정적 사이트라 SVG는 브라우저에서 렌더되므로
// <script>·이벤트 핸들러·javascript:/data: URL은 XSS/누출 벡터다. mermaid가 라벨에
// foreignObject(SVG 내 HTML)를 쓰지만 컨테이너 자체는 위협이 아니다 — 그 안의 능동
// 콘텐츠가 위협이라, 아래 치환은 foreignObject 내부를 포함해 SVG 문자열 전역에 적용된다.
// 남아있으면 빌드를 실패시킨다.
//
// 범위 주의: 이건 mermaid(securityLevel:strict)로 *생성된* SVG에 대한 defense-in-depth
// 이지 포괄적 hostile-SVG sanitizer가 아니다. 인코딩된 프로토콜(`&#x6a;avascript:`),
// 제어문자/공백 변형, CSS `url()` 트릭 등은 정규식이 디코드하지 않는다. 임의 SVG 업로드를
// 받는 단계(플랫폼 Phase 1)가 오면 실제 SVG sanitizer(DOMPurify 등)를 쓰거나 raw SVG를 금지할 것.
const ACTIVE_CONTENT_RE =
  /<script\b|\son[a-z]+\s*=|(?:xlink:href|href)\s*=\s*["']?\s*(?:javascript|data):/i;

// 갓 렌더된(mermaid 출력) SVG를 정리한다 — strip 후에도 능동 콘텐츠가 남으면
// stripper 자체의 결함이므로 빌드를 실패시킨다. 캐시에 쓰기 전에만 호출한다.
function sanitizeSvg(svg) {
  const s = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/(xlink:href|href)\s*=\s*"(?:javascript|data):[^"]*"/gi, '$1=""')
    .replace(/(xlink:href|href)\s*=\s*'(?:javascript|data):[^']*'/gi, "$1=''");
  if (ACTIVE_CONTENT_RE.test(s)) {
    throw new Error('[mermaid] SVG sanitization failed: active content remains after strip');
  }
  return s;
}

// 인라인 직전 게이트. 캐시는 sanitizeSvg를 거쳐 *이미 깨끗*해야 한다 — 그런데
// 능동 콘텐츠가 보이면 오염/stale 캐시 신호이므로 조용히 고치지 않고 시끄럽게 실패한다.
// (캐시 히트 경로 = CF Pages·로컬 재빌드·CI. 여기서 막아야 진짜 safe-by-construction.)
function assertSvgClean(svg, where) {
  if (ACTIVE_CONTENT_RE.test(svg)) {
    throw new Error(
      `[mermaid] active content in SVG (${where}) — refusing to inline. ` +
        `Likely poisoned/stale .mermaid-cache; delete it and re-render (\`pnpm build\`), then recommit.`,
    );
  }
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
        m.svg = sanitizeSvg(value.svg);
        writeFileSync(m.cachePath, m.svg, 'utf8');
      });
    }

    // mermaid code 노드를 raw HTML 노드로 변형한다 (트리 참조 유지).
    // 인라인 직전에 출처 무관하게 게이트한다 — 캐시 히트 경로(CF Pages·로컬 재빌드·CI)는
    // 커밋된 캐시를 읽으므로, 오염·stale 캐시도 여기서 빌드를 실패시킨다.
    // 불변식: "능동 콘텐츠가 든 SVG는 절대 인라인되지 않는다."
    for (const t of targets) {
      assertSvgClean(t.svg, t.cachePath);
      t.node.type = 'html';
      t.node.value = figureHtml(t.svg, t.source);
      delete t.node.lang;
      delete t.node.meta;
    }
  };
}
