import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { localizePath } from '../i18n/ui';

// /llms-full.txt — 발행된 모든 글의 전문 덤프 (llmstxt.org 관례).
// 요약 색인은 /llms.txt. raw body는 이미 redaction을 통과한 발행본만 포함된다.
export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, '');
  const published = (
    await getCollection('blog', ({ data }) => !data.draft && data.redactionReviewed)
  ).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const sections = published
    .map((p) => {
      const url = `${site}${localizePath(`/blog/${p.id}/`, p.data.lang)}`;
      return `# ${p.data.title}
URL: ${url}
Lang: ${p.data.lang} | Category: ${p.data.category} | Published: ${p.data.pubDate.toISOString().slice(0, 10)}
Tags: ${p.data.tags.join(', ')}

${p.body ?? ''}`;
    })
    .join('\n\n---\n\n');

  const body = `# Ascendy Engineering — full content dump for LLMs

> 발행된 모든 글의 전문입니다. 사람용 사이트는 ${site}/ , 요약 색인은 ${site}/llms.txt .

${sections || '(아직 발행된 글이 없습니다 / no posts yet)'}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
