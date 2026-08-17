import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { localizePath } from '../../../i18n/ui';

// 서비스 블로그 전용 피드. 기술 블로그 피드(/rss.xml)와 분리돼 있어
// 엔지니어 구독자에게 사용자용 글이 섞이지 않는다.
export async function GET(context: APIContext) {
  const posts = await getCollection('stories', ({ data }) => !data.draft && data.redactionReviewed && data.lang === 'en');

  return rss({
    title: 'Ascendy — Stories',
    description: 'Notes on finding and using the photos you already have',
    site: context.site!,
    // 브라우저로 열었을 때 태그 트리 대신 읽을 만한 페이지가 보이게 한다.
    stylesheet: '/rss-en.xsl',
    items: posts
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: localizePath(`/stories/${post.id}/`, 'en'),
        categories: post.data.tags,
      })),
  });
}
