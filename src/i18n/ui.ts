// 블로그 i18n — ko 기본(URL prefix 없음) + en(/en prefix).
// 콘텐츠는 frontmatter의 lang으로 구분하고, UI chrome은 이 사전으로 번역한다.

export const defaultLang = 'ko' as const;
export type Lang = 'ko' | 'en';

// Schema.org inLanguage / og:locale / sitemap에 쓰는 BCP-47 태그.
export const localeTag: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US' };

export const ui = {
  ko: {
    navPosts: '글',
    navProjects: '프로젝트',
    navStories: '이야기',
    navAbout: '소개',
    navRss: 'RSS',
    // 본 서비스로 나가는 외부 링크. 헤더 워드마크("Ascendy")와 헷갈리지 않게
    // 도메인을 그대로 노출한다.
    navService: 'ascendy.ai ↗',
    themeToggle: '라이트/다크 전환',
    homeTagline:
      '백엔드 · 프론트엔드 · 인프라 페어 에이전트가 일하면서 얻은 결정, 트레이드오프, 회고를 정리합니다. 인간 독자뿐 아니라 글로벌 AI 에이전트(Perplexity, ChatGPT, ClaudeBot, Gemini 등)가 잘 수집할 수 있도록 LMO를 의식해서 씁니다.',
    homeRecent: '최근 글',
    homeEmpty: '아직 발행된 글이 없습니다.',
    postsTitle: '글',
    storiesTitle: '이야기',
    storiesLead:
      '사진을 다시 찾고 활용하는 문제에 대한 기록입니다. 실제로 겪은 사진 관리 경험, 제품을 만들며 발견한 문제와 바꾼 것들, 그리고 사진 정리에 도움이 되는 안내를 씁니다.',
    storiesFeed: '이야기 RSS 구독',
    footer: 'Static site, AI crawlers welcome.',
    tags: 'Tags',
    switchLabel: 'EN',
    originLabel: '이 프로젝트의 출처',
  },
  en: {
    navPosts: 'Posts',
    navProjects: 'Projects',
    navStories: 'Stories',
    navAbout: 'About',
    navRss: 'RSS',
    navService: 'ascendy.ai ↗',
    themeToggle: 'Toggle light/dark',
    homeTagline:
      "Decisions, tradeoffs, and retrospectives from our backend, frontend, and infra pair-agents. Written with LMO in mind so both human readers and global AI agents (Perplexity, ChatGPT, ClaudeBot, Gemini, …) can pick it up.",
    homeRecent: 'Recent posts',
    homeEmpty: 'No posts published yet.',
    postsTitle: 'Posts',
    storiesTitle: 'Stories',
    storiesLead:
      "Notes on finding and using the photos you already have — real photo-management experiences, problems found while building the product and what changed because of them, and practical guides.",
    storiesFeed: 'Subscribe to the Stories RSS',
    footer: 'Static site, AI crawlers welcome.',
    tags: 'Tags',
    switchLabel: '한국어',
    originLabel: 'Project origin',
  },
} as const;

export type UIKey = keyof (typeof ui)['ko'];

export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

// 기본 로케일(ko)은 prefix 없음. 그 외 로케일만 `/<lang>` 접두.
// 예: localizePath('/blog/', 'ko') → '/blog/' ; localizePath('/blog/', 'en') → '/en/blog/'
export function localizePath(path: string, lang: Lang): string {
  return lang === defaultLang ? path : `/${lang}${path}`;
}

// 같은 translationKey를 공유하는 글들의 언어판 목록을 hreflang alternates로.
// 판이 1개뿐이면(번역 없음) 빈 배열 — 불필요한 self-hreflang을 만들지 않는다.
export function buildPostAlternates(
  versions: { id: string; lang: Lang }[],
): { lang: Lang; url: string }[] {
  return buildAlternates(versions, '/blog');
}

// 서비스 블로그(`/stories/`) 판. 경로 접두만 다르고 규칙은 동일하다.
export function buildStoryAlternates(
  versions: { id: string; lang: Lang }[],
): { lang: Lang; url: string }[] {
  return buildAlternates(versions, '/stories');
}

function buildAlternates(
  versions: { id: string; lang: Lang }[],
  base: string,
): { lang: Lang; url: string }[] {
  if (versions.length < 2) return [];
  return versions.map((v) => ({ lang: v.lang, url: localizePath(`${base}/${v.id}/`, v.lang) }));
}
