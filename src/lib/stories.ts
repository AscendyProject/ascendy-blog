import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * 발행된 서비스 블로그 글 목록.
 *
 * 여기서 **ko/en 쌍을 빌드 시 강제**한다. 서비스 블로그의 1차 타깃 시장이 북미라
 * en 판은 선택이 아니고(docs/service-blog-policy.md §10), 스키마는 단일 엔트리만
 * 보므로 상대 언어판의 존재를 알 수 없다. 그래서 컬렉션을 읽는 이 지점에서 한 번
 * 검사하고, 모든 stories 라우트·피드·LLM 덤프가 이 함수를 거치게 한다.
 *
 * 한쪽만 발행 상태면 빌드를 실패시킨다 — 조용히 한 언어만 나가는 것보다 낫다.
 */
export async function getPublishedStories(): Promise<CollectionEntry<'stories'>[]> {
  const published = await getCollection(
    'stories',
    ({ data }) => !data.draft && data.redactionReviewed,
  );

  const byKey = new Map<string, Set<'ko' | 'en'>>();
  for (const post of published) {
    const langs = byKey.get(post.data.translationKey) ?? new Set<'ko' | 'en'>();
    langs.add(post.data.lang);
    byKey.set(post.data.translationKey, langs);
  }

  const unpaired = [...byKey.entries()]
    .filter(([, langs]) => langs.size < 2)
    .map(([key, langs]) => `${key} (${[...langs].join(', ')}만 발행됨)`);

  if (unpaired.length > 0) {
    throw new Error(
      `[stories] ko/en 짝이 없는 발행 글이 있습니다: ${unpaired.join(' / ')}\n` +
        '서비스 블로그는 ko 원문과 en 판을 함께 냅니다(docs/service-blog-policy.md §10).\n' +
        '아직 번역 전이라면 한쪽을 draft: true로 두세요.',
    );
  }

  return published;
}
