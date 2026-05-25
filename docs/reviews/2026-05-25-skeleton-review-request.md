# Round 001 — Skeleton Review Request (Claude → Codex)

- Date: 2026-05-25
- From: Claude (blog team, surface:24)
- To: Codex (blog team, surface:23)
- Workspace: cmux `ascendy-blog`
- Working dir: `/Users/kh/Documents/ascendy/ascendy-blog/`
- Branch state: **새 디렉토리, 아직 git init 전.** 상위 워크스페이스
  (`/Users/kh/Documents/ascendy/`) 기준으로 `ascendy-blog/`는 untracked
  로 보임. 상위 `.gitignore` 갱신은 별도 PR로 분리 예정 (현재 상위 브랜
  치 `chore/helm-vcr-secret-phase1`는 무관).

## Context

사용자 요청 요지:
1. 기술 블로그 운영 스택을 Astro + Cloudflare Pages로 구축
2. 인간 + 글로벌 AI 에이전트(LMO) 양쪽이 잘 수집할 수 있는 구조
3. 백엔드/프론트엔드/인프라 페어 팀(각 Claude+Codex)이 인테이크를 떨구면
   블로그팀(Claude 메인 + Codex 리뷰)이 가공·게시
4. Round 001은 **계획 타당성 검토 + 디렉토리 틀 + CLAUDE.md/AGENTS.md
   작성**까지

사용자 결정 (3개 핵심 질문, AskUserQuestion으로 확정):
- 디렉토리 배치: `ascendy-blog/`를 **gitignored sibling**으로
  (backend/frontend와 동일 패턴), 별도 GitHub repo 예정
- 인테이크/편집정책 위치: **블로그 repo 내부** (`ascendy-blog/docs/`)
- GitHub 가시성: **처음부터 public**

## 생성된 산출물 (26 파일)

거버넌스 (메인):
- `CLAUDE.md` — 블로그팀 Claude 운영 규칙
- `AGENTS.md` — 블로그팀 Codex(당신) 리뷰어 규칙
- `docs/editorial-policy.md`
- `docs/redaction-checklist.md`
- `docs/intake-template.md`
- `docs/intake/from-{backend,frontend,infra}/.gitkeep`

Astro 스켈레톤:
- `package.json` (Astro 5 + Tailwind v4 + MDX + `@astrojs/sitemap` + `@astrojs/rss`)
- `astro.config.mjs` — adapter 의도적으로 생략 (정적 only)
- `tsconfig.json` (astro strict 상속)
- `.gitignore`
- `src/content.config.ts` — Content Collections 스키마 (필수: title,
  description, pubDate, tags, category, sourceIntake, redactionReviewed)
- `src/components/SchemaOrg.astro` — JSON-LD 자동 주입 (BlogPosting /
  WebSite / CollectionPage)
- `src/components/BaseHead.astro` — OG/Twitter/canonical
- `src/layouts/{Base,Post}Layout.astro`
- `src/pages/index.astro`, `src/pages/blog/index.astro`,
  `src/pages/blog/[...slug].astro`, `src/pages/rss.xml.ts`
- `src/styles/global.css` (Tailwind v4 `@import "tailwindcss";`)
- `src/content/blog/_template.md` (표준 템플릿) + `hello-ascendy.md` (예시)
- `public/robots.txt` (GPTBot, ClaudeBot, PerplexityBot, Google-Extended
  등 22개 명시 허용)
- `README.md`

## 의도적으로 안 한 일

- `pnpm install` / `npm install` 미실행
- `git init` 미실행 (사용자가 GitHub repo 만들 시점에 동시)
- GitHub repo 생성 (`gh repo create` — 사용자 영역)
- 상위 워크스페이스 governance 갱신 (별도 브랜치/PR로 분리: top-level
  `.gitignore` + `docs/agent-os/infra-inventory.md` + `infra-path-ownership.md`)

## 리뷰 범위 (review surface)

이번 round에서 봐달라:

1. **거버넌스 정합성** — `CLAUDE.md`/`AGENTS.md`가 상위 워크스페이스의
   3자 모델(Claude+Codex+사용자), forbidden surfaces 정책, agent-execution
   constraint를 일관되게 계승하는지. 누락/모순.
2. **redaction 체크리스트 강도** — `docs/redaction-checklist.md` §0~§6
   에서 빠진 위협, 또는 과도하게 잡힌 항목. 특히 상위 워크스페이스
   CLAUDE.md에 나열된 forbidden surfaces(`.env*`, `.mc/**`, `helm/langfuse-*`,
   `kubeconfig*`, `*.pem`, `*.key`, VCR 이미지 태그)를 전부 커버하는지.
3. **인테이크 형식의 작동성** — `docs/intake-template.md`의 필드/구조가
   3팀 입장에서 실제로 떨굴 만한 형식인지. 누락된 메타(예: license/
   copyright, 검수자 식별, urgency)가 있는지.
4. **Astro 구조의 작동성** — Astro 5 Content Collections v2 사용법
   (특히 `glob` loader + `defineCollection` 스키마), `src/content.config.ts`
   위치, `SchemaOrg.astro`의 JSON-LD 모양, Tailwind v4 통합 방식.
   `pnpm build`가 통과할 가능성에 대한 의견.
5. **LMO 의식** — robots.txt 화이트리스트가 합리적인지, JSON-LD 타입
   선택(BlogPosting/WebSite/CollectionPage)이 적절한지, `description`
   길이 제약(40~220)이 OG/메타 기준에 맞는지, llms.txt/llms-full.txt를
   다음 round에서 우선순위로 둘 만한지.
6. **운영 모델 일관성** — "인테이크 → 편집 → redaction 통과 → 사람 머지
   → CF Pages 자동 배포" 흐름의 빈틈. 예: 인테이크가 오지 않을 때
   블로그팀의 동작 정의, draft가 main에 실수로 머지될 경우 가드.

## 명시적 비교 지점 (Claude가 사용자에게 이미 보고함)

아래 5개는 사용자에게 "Codex와 분기 가능성 있는 지점"으로 미리 공지함.
당신의 입장을 명확히 해달라:

A. **dir 배치** — 저(Claude)는 gitignored sibling 선택. 동의?
B. **Tailwind 버전** — 저는 v4 채택 (`@tailwindcss/vite`, CSS-first).
   v3 권장이면 이유.
C. **Cloudflare adapter** — 저는 adapter 없이 정적 only.
   `@astrojs/cloudflare` 강요할 사유 있는가?
D. **redaction 체크리스트 강도** — §0~§6 적정한가, 강화/축소?
E. **인테이크 형식** — 저는 블로그 repo 내부 자체 표준.
   상위 `docs/agent-os/requests/`와 통합 주장하면 거버넌스 중복 trade-off.

## 기대 출력 포맷

각 리뷰 항목별로:

```markdown
### [번호. 항목명]
**Agree:** ...
**Disagree:** (있다면, file:line 인용 + 근거)
**Uncertain:** (확신 못하는 부분, 추가 검증 필요)
```

전체 결론:

```markdown
REVIEW_DECISION: <APPROVE | REQUEST_CHANGES | BLOCK>
```

- APPROVE: 작은 개선 의견은 있지만 머지 가능
- REQUEST_CHANGES: 머지 전 수정 필요한 항목 1개 이상
- BLOCK: 구조적 결함, 다시 설계 권장

## 안티패턴 (피해줘)

- 동의만 적는 리뷰 ("문제 없어 보입니다" 단독).
- 자기 scope 확장 (이 round에서 정책 문서 본인 손으로 약화/재작성하지 말 것).
- 추측으로 단정 — 가능하면 `pnpm install && pnpm check && pnpm build`로
  실측 후 보고. 실측 못했으면 그렇게 명시.
- 코드 작성 시작 (당신은 리뷰어, Claude가 메인 작업자).

회신은 동일 워크스페이스 surface:24 (Claude)로 `cmux send`. 또는
`docs/reviews/2026-05-25-skeleton-review-codex.md`에 작성 후 경로 알림.

머지 권한은 사용자만. Codex와 Claude 모두 `gh pr merge` 금지.
