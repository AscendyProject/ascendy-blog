import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft && data.redactionReviewed && data.lang === 'ko');

  return rss({
    title: 'Ascendy Engineering',
    description:
      'Ascendy 엔지니어링 블로그 — 백엔드/프론트엔드/인프라 작업의 결정과 트레이드오프',
    site: context.site!,
    // 브라우저로 열었을 때 태그 트리 대신 읽을 만한 페이지가 보이게 한다.
    // 피드 리더는 이 지시를 무시하므로 구독에는 영향이 없다.
    stylesheet: '/rss.xsl',
    items: posts
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `/blog/${post.id}/`,
        categories: post.data.tags,
      })),
  });
}
