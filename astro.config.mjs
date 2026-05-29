import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMermaidFigure from './src/lib/remark-mermaid-figure.mjs';

// Cloudflare Pages는 출력된 dist/를 그대로 정적 호스팅하므로
// adapter는 의도적으로 생략. 동적 라우트가 필요해지면 그때
// @astrojs/cloudflare 추가.
export default defineConfig({
  site: 'https://blog.ascendy.ai',
  // ko 기본(URL prefix 없음) + en(/en). 기본 로케일 URL은 안 바뀌어
  // 기존 한국어 글 링크가 깨지지 않는다.
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'ko',
        locales: { ko: 'ko-KR', en: 'en-US' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    // ```mermaid 펜스를 Shiki 하이라이트(rehype 단계) 이전에 빌드타임 SVG로
    // 변환한다 (remark 단계). 그 외 코드 블록은 기존대로 Shiki가 처리한다.
    remarkPlugins: [remarkMermaidFigure],
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
});
