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
