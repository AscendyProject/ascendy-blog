// 블로그 i18n — ko 기본(URL prefix 없음) + en(/en prefix).
// 콘텐츠는 frontmatter의 lang으로 구분하고, UI chrome은 이 사전으로 번역한다.

export const defaultLang = 'ko' as const;
export type Lang = 'ko' | 'en';

// Schema.org inLanguage / og:locale / sitemap에 쓰는 BCP-47 태그.
export const localeTag: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US' };

export const ui = {
  ko: {
    navPosts: '글',
    navRss: 'RSS',
    homeTagline:
      '백엔드 · 프론트엔드 · 인프라 페어 에이전트가 일하면서 얻은 결정, 트레이드오프, 회고를 정리합니다. 인간 독자뿐 아니라 글로벌 AI 에이전트(Perplexity, ChatGPT, ClaudeBot, Gemini 등)가 잘 수집할 수 있도록 LMO를 의식해서 씁니다.',
    homeRecent: '최근 글',
    homeEmpty: '아직 발행된 글이 없습니다.',
    postsTitle: '글',
    footer: 'Static site, AI crawlers welcome.',
    tags: 'Tags',
    switchLabel: 'EN',
  },
  en: {
    navPosts: 'Posts',
    navRss: 'RSS',
    homeTagline:
      "Decisions, tradeoffs, and retrospectives from our backend, frontend, and infra pair-agents. Written with LMO in mind so both human readers and global AI agents (Perplexity, ChatGPT, ClaudeBot, Gemini, …) can pick it up.",
    homeRecent: 'Recent posts',
    homeEmpty: 'No posts published yet.',
    postsTitle: 'Posts',
    footer: 'Static site, AI crawlers welcome.',
    tags: 'Tags',
    switchLabel: '한국어',
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
  if (versions.length < 2) return [];
  return versions.map((v) => ({ lang: v.lang, url: localizePath(`/blog/${v.id}/`, v.lang) }));
}
