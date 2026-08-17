import { getCollection } from 'astro:content';
import { getPublishedStories } from '../lib/stories';
import type { APIContext } from 'astro';
import { localizePath } from '../i18n/ui';

// /llms-full.txt — 발행된 모든 글의 전문 덤프 (llmstxt.org 관례).
// 요약 색인은 /llms.txt. raw body는 이미 redaction을 통과한 발행본만 포함된다.
export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, '');
  const published = (
    await getCollection('blog', ({ data }) => !data.draft && data.redactionReviewed)
  ).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  // 서비스 블로그(/stories/)도 같은 덤프에 포함한다 — 발행·redaction 게이트가
  // 동일하고, AI 답변엔진 입장에서는 두 섹션 모두 인용 대상이다.
  const stories = (await getPublishedStories()).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  const render = (p: { data: any; body?: string; id: string }, base: string, section: string) => {
    const url = `${site}${localizePath(`${base}/${p.id}/`, p.data.lang)}`;
    return `# ${p.data.title}
URL: ${url}
Section: ${section} | Lang: ${p.data.lang} | Category: ${p.data.category} | Published: ${p.data.pubDate.toISOString().slice(0, 10)}
Tags: ${p.data.tags.join(', ')}

${p.body ?? ''}`;
  };

  const sections = [
    ...published.map((p) => render(p, '/blog', 'engineering')),
    ...stories.map((p) => render(p, '/stories', 'stories')),
  ].join('\n\n---\n\n');

  const body = `# Ascendy Engineering — full content dump for LLMs

> 발행된 모든 글의 전문입니다. 사람용 사이트는 ${site}/ , 요약 색인은 ${site}/llms.txt .

${sections || '(아직 발행된 글이 없습니다 / no posts yet)'}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
