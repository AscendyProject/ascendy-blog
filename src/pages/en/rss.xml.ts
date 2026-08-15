import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { localizePath } from '../../i18n/ui';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft && data.redactionReviewed && data.lang === 'en');

  return rss({
    title: 'Ascendy Engineering',
    description:
      'Ascendy Engineering blog — decisions and tradeoffs from backend/frontend/infra work.',
    site: context.site!,
    // 브라우저로 열었을 때 태그 트리 대신 읽을 만한 페이지가 보이게 한다.
    // 피드 리더는 이 지시를 무시하므로 구독에는 영향이 없다.
    stylesheet: '/rss-en.xsl',
    items: posts
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: localizePath(`/blog/${post.id}/`, 'en'),
        categories: post.data.tags,
      })),
  });
}
