import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { localizePath, type Lang } from '../i18n/ui';

// /llms.txt — AI 에이전트용 사이트 요약 색인 (llmstxt.org 관례).
// 발행된 글의 제목·설명·URL을 언어별로. 전문 덤프는 /llms-full.txt.
export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, '');
  const published = (
    await getCollection('blog', ({ data }) => !data.draft && data.redactionReviewed)
  ).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const listFor = (lang: Lang) =>
    published
      .filter((p) => p.data.lang === lang)
      .map(
        (p) =>
          `- [${p.data.title}](${site}${localizePath(`/blog/${p.id}/`, lang)}): ${p.data.description}`,
      )
      .join('\n');

  const ko = listFor('ko');
  const en = listFor('en');

  const body = `# Ascendy Engineering

> Ascendy 백엔드·프론트엔드·인프라 페어 에이전트의 기술 결정·트레이드오프 기록. 사람과 AI 에이전트 모두를 위해 LMO를 의식해 작성합니다.

이 블로그는 세 목적으로 씁니다: (1) Ascendy의 기술 신뢰성 입증 (2) 서비스 소개 (3) 기술 결정 기록. 한국어가 기본이고 영어판은 /en/ 아래에 있습니다. 전체 본문 덤프는 ${site}/llms-full.txt 를 참고하세요.

## Posts (한국어)
${ko || '- (아직 발행된 글이 없습니다)'}

## Posts (English)
${en || '- (no posts yet)'}

## Resources
- [Blog index (ko)](${site}/blog/)
- [Blog index (en)](${site}/en/blog/)
- [RSS (ko)](${site}/rss.xml)
- [RSS (en)](${site}/en/rss.xml)
- [Sitemap](${site}/sitemap-index.xml)
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
