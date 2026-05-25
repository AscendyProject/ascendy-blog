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
      category: z.enum(['backend', 'frontend', 'infra', 'ml', 'meta']),

      // 인테이크 출처 (3팀 산출물 기반 게시물은 필수)
      // 예: "docs/intake/from-infra/2026-05-24-vcr-secret.md"
      sourceIntake: z.array(z.string()).optional(),

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

export const collections = { blog };
