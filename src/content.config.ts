import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 블로그 포스트 Content Collection.
// frontmatter는 사람이 읽고 Schema.org JSON-LD가 빌드 시 소비한다.
// 필수 필드는 redaction/저작권/인테이크 추적을 강제하기 위함이며
// CLAUDE.md "Hard rules"와 docs/editorial-policy.md에 묶여 있다.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(8).max(120),
      description: z.string().min(40).max(220),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().default('Ascendy Engineering'),

      // 분류
      tags: z.array(z.string()).min(1),
      category: z.enum(['backend', 'frontend', 'infra', 'ml', 'meta', 'product']),

      // i18n: 글의 언어. en은 /en/blog/<slug>로 라우팅된다.
      lang: z.enum(['ko', 'en']).default('ko'),
      // 같은 글의 ko/en 판을 짝짓는 키 (hreflang 상호 링크용).
      // 예: ko와 en 모두 translationKey: "how-this-blog-is-written"
      translationKey: z.string().optional(),

      // 인테이크 출처 (3팀 산출물 기반 게시물은 필수)
      // 예: "docs/intake/from-infra/2026-05-24-vcr-secret.md"
      sourceIntake: z.array(z.string()).optional(),

      // 프로젝트 출처(provenance) — CTA가 아니라 "이 글/도구가 어떤 실제
      // 문제에서 나왔는가"를 맥락으로 제공한다(A안: 유도가 아니라 출처).
      // 글 하단에 ProjectOrigin 컴포넌트로 렌더된다. redteam 같은 OSS 글에 적용.
      origin: z
        .object({
          project: z.string(),
          repo: z.string().url(),
          summary: z.string(),
        })
        .optional(),

      // 게재 상태
      draft: z.boolean().default(false),

      // SEO/LMO
      heroImage: image().optional(),
      heroImageAlt: z.string().optional(),
      canonical: z.string().url().optional(),

      // redaction 체크리스트 통과 여부 (게시 전 true 필요)
      redactionReviewed: z.boolean().default(false),
    }),
});

// 서비스 블로그(Service Blog) Content Collection — `/stories/`.
//
// 기술 블로그(blog)와 독자·목적·톤이 다르다. blog가 엔지니어를 향한 결정·
// 트레이드오프 기록이라면, stories는 일반 사용자(사진을 많이 찍는 사람, 부모,
// 가족)를 향한 실제 문제와 경험, 그리고 Build in Public 기록이다.
// 편집 규약은 docs/service-blog-policy.md가 구속한다.
//
// 컬렉션을 분리한 이유: 카테고리 값만 나누면 인덱스·RSS·내비게이션이 그대로
// 섞인다. 두 독자를 한 목록에 세우지 않으려면 라우트와 피드가 갈려야 한다.
const stories = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/stories' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(8).max(120),
        description: z.string().min(40).max(220),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        // 서비스 블로그는 창업자 1인칭이 기본이라 기술 블로그와 기본값이 다르다.
        author: z.string().default('Ascendy'),

        tags: z.array(z.string()).min(1),
        // docs/service-blog-policy.md의 4개 축과 1:1로 대응한다.
        //   real-stories — 실제 사진 관리 경험
        //   building     — Build in Public (문제 발견 → 변경 → 달라진 경험)
        //   guides       — 사진 관리 정보성 콘텐츠 (검색 유입)
        //   philosophy   — 왜 이 제품을 만드는가
        category: z.enum(['real-stories', 'building', 'guides', 'philosophy']),

        lang: z.enum(['ko', 'en']).default('ko'),
        translationKey: z.string().optional(),

        // 1차 소스 경로. 아래 refine이 카테고리에 따라 필수로 강제한다.
        sourceIntake: z.array(z.string()).optional(),

        draft: z.boolean().default(false),

        heroImage: image().optional(),
        heroImageAlt: z.string().optional(),
        canonical: z.string().url().optional(),

        redactionReviewed: z.boolean().default(false),
      })
      // ── 날조 방지 게이트 (빌드타임 강제) ────────────────────────────
      // 서비스 블로그의 최대 위험은 시크릿 누출이 아니라 **없는 경험을 지어내는
      // 것**이다. 1차 소스가 창업자의 기억에만 있어서, "모르면 물어본다"는
      // 규칙만으로는 지켜지지 않는다(글을 쓰라는 지시를 받은 에이전트는 빈칸을
      // 그럴듯하게 메운다).
      //
      // 그래서 개인 경험·제품 주장이 실리는 세 카테고리는 sourceIntake를
      // **스키마 레벨에서 필수**로 만든다. 인터뷰 정제본이든 제품 변경 기록이든,
      // 근거 파일 없이는 빌드가 실패한다. guides는 정보성이라 면제.
      .refine((d) => d.category === 'guides' || (d.sourceIntake?.length ?? 0) > 0, {
        message:
          'real-stories/building/philosophy 글은 sourceIntake가 필수입니다 — 창업자 경험은 인터뷰 정제본(docs/intake/from-user/…)을 통해서만 들어옵니다. docs/service-blog-policy.md 참조.',
        path: ['sourceIntake'],
      }),
});

export const collections = { blog, stories };
