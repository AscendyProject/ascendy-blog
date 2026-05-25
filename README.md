# ascendy-blog

Ascendy 프로젝트의 공개 기술 블로그. Astro 정적 사이트 + Cloudflare Pages
배포. 인간 독자뿐 아니라 글로벌 AI 에이전트 크롤러(Perplexity, ChatGPT,
ClaudeBot, Gemini, Google-Extended 등)가 수집·인용하기 좋은 구조(LMO)를
1차 목표로 한다.

## 운영 모델 한 줄

3개 페어 팀(backend / frontend / infra, 각 팀 = Claude + Codex)이 작업
부산물을 `docs/intake/from-<team>/`에 인테이크 문서로 떨어뜨리면, 블로그
팀(Claude 메인 + Codex 리뷰)이 편집·redaction·SEO/LMO 메타 주입 후
`src/content/blog/`로 게시한다. 사람은 머지만 한다.

세 가지 거버넌스 문서가 binding이다:

- [`CLAUDE.md`](./CLAUDE.md) — 블로그팀 Claude 운영 규칙
- [`AGENTS.md`](./AGENTS.md) — 블로그팀 Codex 운영 규칙
- [`docs/editorial-policy.md`](./docs/editorial-policy.md) — 편집 정책
- [`docs/redaction-checklist.md`](./docs/redaction-checklist.md) — 정보 누설 방지 체크리스트
- [`docs/intake-template.md`](./docs/intake-template.md) — 3팀이 떨어뜨리는 인테이크 표준 포맷

## 빠른 시작 (개발자용 메모)

```bash
# 처음 한 번
pnpm install        # 또는 npm install

# 개발
pnpm dev            # http://localhost:4321

# 빌드/프리뷰
pnpm build
pnpm preview
```

배포는 Cloudflare Pages가 GitHub repo의 main 브랜치를 watch → `pnpm build`
→ `dist/` 자동 배포. **에이전트는 `wrangler deploy`를 직접 실행하지 않는다.**
머지가 곧 배포다.

## 스택

- Astro 5 (Content Collections v2, MDX 지원)
- Tailwind CSS v4 (`@tailwindcss/vite`)
- `@astrojs/sitemap` — sitemap.xml 자동 생성
- `@astrojs/mdx` — MDX 지원
- Schema.org JSON-LD 자동 주입 (`src/components/SchemaOrg.astro`)
- llms.txt / llms-full.txt build-time 생성 (TODO)
- Cloudflare Pages 정적 호스팅 (어댑터 없이 `dist/` 직접 서빙)

## 디렉토리 구조

```
ascendy-blog/
├── public/                    # robots.txt, favicon, 정적 에셋
├── src/
│   ├── components/            # SchemaOrg, BaseHead 등
│   ├── content/blog/          # 발행되는 포스트 (Content Collections)
│   ├── layouts/               # BaseLayout, PostLayout
│   ├── pages/                 # 라우트
│   ├── styles/                # Tailwind global.css
│   └── content.config.ts      # Content Collections 스키마
├── docs/
│   ├── editorial-policy.md
│   ├── redaction-checklist.md
│   ├── intake-template.md
│   └── intake/
│       ├── from-backend/
│       ├── from-frontend/
│       └── from-infra/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── CLAUDE.md                  # 블로그팀 Claude 거버넌스
├── AGENTS.md                  # 블로그팀 Codex 거버넌스
└── README.md
```
