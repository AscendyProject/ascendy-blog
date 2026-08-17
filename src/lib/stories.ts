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

  // 언어 집합(Set)만 보면 "ko 2편 + en 1편"이 통과한다. 그러면 두 ko 글이 같은
  // en 판을 alternate로 물어 hreflang이 중복·모호해진다. 그래서 키마다 언어별
  // **개수**를 세고, 정확히 ko 1편 + en 1편일 때만 통과시킨다.
  const counts = new Map<string, { ko: number; en: number }>();
  for (const post of published) {
    const c = counts.get(post.data.translationKey) ?? { ko: 0, en: 0 };
    c[post.data.lang] += 1;
    counts.set(post.data.translationKey, c);
  }

  const problems = [...counts.entries()]
    .filter(([, c]) => c.ko !== 1 || c.en !== 1)
    .map(([key, c]) => `${key} (ko ${c.ko}편, en ${c.en}편)`);

  if (problems.length > 0) {
    throw new Error(
      `[stories] translationKey마다 ko 1편 + en 1편이어야 합니다: ${problems.join(' / ')}\n` +
        '서비스 블로그는 ko 원문과 en 판을 함께 냅니다(docs/service-blog-policy.md §10).\n' +
        '아직 번역 전이라면 한쪽을 draft: true로, 키가 겹쳤다면 translationKey를 고치세요.',
    );
  }

  return published;
}
