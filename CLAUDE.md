# ascendy-blog — Claude 운영 가이드

이 파일은 `ascendy-blog/` 디렉토리에서 동작하는 Claude 세션의 운영 규칙
이다. 상위 워크스페이스 `~/Documents/ascendy/`의 `CLAUDE.md`는 인프라
거버넌스를 다루고, 이 파일은 **블로그 콘텐츠 생산과 게시**를 다룬다.

## Scope

이 파일은 `ascendy-blog/` 안에서 실행되는 Claude 세션만 지배한다. 상위
워크스페이스(인프라)의 가이드와 본 파일이 충돌하면 — `ascendy-blog/`
경로 안의 일은 본 파일이 우선, 경로 바깥의 일은 상위 가이드가 우선.

## 두 개의 블로그

이 저장소는 **독자와 목적이 다른 두 블로그**를 한 사이트에서 운영한다.

| | 기술 블로그 | 서비스 블로그 |
|---|---|---|
| 경로 | `/blog/` · `/en/blog/` | `/stories/` · `/en/stories/` |
| 컬렉션 | `blog` | `stories` |
| RSS | `/rss.xml` · `/en/rss.xml` | `/stories/rss.xml` · `/en/stories/rss.xml` |
| 독자 | 개발자·엔지니어 | 사진을 많이 찍는 일반 사용자·가족 |
| 화자 | "우리"(팀) | "나"(창업자 1인칭) |
| 구속 문서 | `docs/editorial-policy.md` | **`docs/service-blog-policy.md`** |

**세션을 분리해 운영한다.** 저장소·배포·인테이크 파이프라인·`/redteam:review`는
공유하되, 서비스 블로그 작업은 별도 세션에서 한다 — 목소리와 독자가 다르고 기술
블로그 맥락이 프레이밍을 끌기 때문이다.

카테고리 값만 나누지 않고 컬렉션·라우트·피드를 갈랐다. 값만 나누면 인덱스·RSS·
내비게이션에서 두 독자가 한 목록에 섞인다.

**서비스 블로그의 날조 방지 게이트(빌드타임).** `stories` 컬렉션의
`real-stories`·`building`·`philosophy` 카테고리는 `sourceIntake`가 **스키마
레벨에서 필수**다. 창업자의 1인칭 경험은 인터뷰 정제본을 통해서만 글에 들어오며,
근거 파일이 없으면 빌드가 실패한다. 자세한 것은 `docs/service-blog-policy.md` §5.

## Operating model

블로그팀은 **편집국**이다. 직접 결정/구현을 만들어내지 않는다.

**글감 소스는 세 가지** — ① 3팀 인테이크 ② 메타(블로그 자체 안내·회고)
③ **사용자 직접 지정**(사용자가 채팅/문서로 주제·자료를 줌). ②·③은
`sourceIntake` 면제이고, 어떤 소스든 redaction은 동일하게 적용된다.

1. 3개 페어 팀(`ascendy-backend`, `ascendy-frontend`, `ascendy-infra`)이
   작업 후 **자기 private repo**의 `docs/blog-intake/YYYY-MM-DD-<topic>.md`에
   글감을 떨군다 (블로그는 public이라 raw를 직접 받지 않는다). 포맷은
   [`docs/intake-template.md`](./docs/intake-template.md) 강제. 블로그팀은
   이를 읽어 redaction 후 정제본만 `docs/intake/from-<team>/`에 커밋한다.
   **사용자 직접 지정** 글감은 사용자가 준 주제/자료가 곧 소스다 — 채팅으로만
   줘도 되고, 기록을 남기려면 `docs/intake/from-user/`에 redaction 후 둔다.
2. 블로그팀 Claude(이 세션)가 **메인 작업자** — 인테이크를 게시물로
   가공한다. 편집 정책은 [`docs/editorial-policy.md`](./docs/editorial-policy.md).
3. **redaction 체크리스트**([`docs/redaction-checklist.md`](./docs/redaction-checklist.md))를
   하나씩 통과시킨다. 통과 못한 항목이 하나라도 있으면 머지 차단.
4. 블로그팀 Codex가 **리뷰어** — 동일 cmux workspace에서 독립적으로 검수
   ([`AGENTS.md`](./AGENTS.md)).
5. 사용자(사람)가 머지 = 즉시 Cloudflare Pages 배포.

세 가지 거버넌스 문서가 binding이다 — 이 `CLAUDE.md`, `editorial-policy.md`,
`redaction-checklist.md`. 비단조로운 콘텐츠 작업이라도 위 세 문서를 먼저
체크한 뒤 시작하라.

이 블로그의 **3대 목적** — ① Ascendy 기술 신뢰성 입증 ② 서비스 홍보(신뢰성으로,
자뻑 아님) ③ 기술 기록 — 은 `editorial-policy.md` "왜 쓰는가"에 정의. 모든
편집 판단은 이 목적에 복무한다. 독자는 사람 + AI 에이전트 **둘 다**(가독성 +
인용 가능성), AO(GEO/AEO)도 같은 문서 참조.

## Stack

- **Astro 5** (Content Collections v2, `glob` loader)
- **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-first 설정)
- **MDX** via `@astrojs/mdx`
- **Sitemap** via `@astrojs/sitemap`
- **RSS** via `@astrojs/rss` (`src/pages/rss.xml.ts`)
- **Schema.org JSON-LD** via `src/components/SchemaOrg.astro` (자동 주입)
- **Cloudflare Pages** 정적 호스팅 — `dist/` 직접 서빙, adapter 없음
- **i18n** — ko 기본(URL prefix 없음) + en(`/en`), Astro `i18n`
  (`prefixDefaultLocale: false`). chrome 사전·헬퍼는 `src/i18n/ui.ts`,
  글은 frontmatter `lang`/`translationKey`로 구분, hreflang/`inLanguage` 동적
- **llms.txt / llms-full.txt** — `src/pages/llms.txt.ts` + `llms-full.txt.ts`
  (발행 글 자동 색인, AI 에이전트 수집용). 발행 게이트 동일 적용.

루트 도메인: `blog.ascendy.ai` (Cloudflare DNS).

## Commands

블로그 작업의 일상 명령. 모두 클러스터/외부 시스템을 건드리지 않음.

```bash
# 처음 한 번
pnpm install              # 또는 npm/yarn

# 개발 (로컬 hot-reload)
pnpm dev                  # http://localhost:4321

# 타입/콘텐츠 스키마 점검
pnpm check                # astro check — frontmatter 스키마 위반 잡힘

# 빌드 / 프리뷰
pnpm build                # → dist/
pnpm preview              # dist/를 로컬 서빙

# 새 글 시작 (수동 — _template.md 복사)
cp src/content/blog/_template.md src/content/blog/<slug>.md
```

배포 명령은 의도적으로 **없다**. Cloudflare Pages가 main 머지를 감지해
자동 빌드·배포한다. `wrangler deploy`는 에이전트가 직접 실행하지 않는다.

## Hard rules

1. **인테이크 없는 게시 금지**. 3팀 산출물 기반 글은 frontmatter
   `sourceIntake:`에 `docs/intake/from-<team>/<file>.md` 경로가 반드시
   들어가야 한다. **메타 카테고리(블로그 자체 안내·회고)와 사용자 직접 지정
   글감은 예외** — sourceIntake 없이 게시 가능(단 redaction은 동일 통과).
2. **redaction 체크리스트 미통과 머지 금지**. `redactionReviewed: true`는
   `docs/redaction-checklist.md`의 모든 항목을 사람/에이전트가 통과시킨
   결과여야 한다. 자동 통과 금지.
3. **draft를 main에 머지 금지**. `draft: true`인 글은 PR에 둘 수 있지만
   main에는 절대 머지하지 않는다 (머지 = 즉시 배포이기 때문).
4. **상위 워크스페이스의 forbidden surfaces를 계승**한다. `.env*`,
   `.mc/**`, `helm/langfuse-*.yaml`, `kubeconfig*`, `*.pem`, `*.key`,
   `firebase-service-account.json`, VCR 비공개 이미지 태그, 사내 호스트명
   — 이들의 **내용**을 본문/코드 블록에 옮기는 것 금지. 추상화·일반화
   후에만 게재.
5. **PR + 사람 머지**. main으로 직접 push 금지. 브랜치 명 `post/<slug>`,
   `chore/<topic>`, `docs/<topic>`.
6. **Cloudflare 콘솔/`wrangler` 명령은 사람만**. `wrangler deploy`,
   `wrangler r2 ...`, Cloudflare Pages 환경변수 수정, DNS 변경, robots.txt
   안의 정책 변경 — 에이전트는 PR로 제안만, 실행은 사용자.
7. **새 의존성/통합 추가는 사용자 승인**. Astro 통합, npm 패키지, 폰트
   로더, 분석 스크립트, 외부 임베드(Twitter, YouTube) 추가 전 PR + 사용자
   confirm.
8. **외부 분석/추적 스크립트 금지**. Google Analytics, Mixpanel, Hotjar,
   FB Pixel 등을 임의로 넣지 않는다 (개인정보 보호 + LMO 목적상 정적
   순도 유지). 도입은 사용자 결정.

## Decision boundaries

혼자 결정 가능:

- 인테이크 기반 초안 작성, 문법/스타일 다듬기
- `_template.md` 따라 새 글 만들기
- 기존 글의 오타·문법·링크 수정 (의미 변경 없는 한)
- Tailwind 클래스 미세 조정 (디자인 토큰은 변경 X)
- `astro.config.mjs`의 동작 영향 없는 정리 (주석, 정렬)
- redaction 체크리스트에 따른 본문 sanitize

사용자에게 먼저 확인:

- **새 카테고리 값 추가** (`backend|frontend|infra|ml|meta` 외)
- **새 npm 의존성** 또는 Astro 통합 추가
- **디자인 시스템 변경** (폰트, 컬러 토큰, 레이아웃 구조)
- **robots.txt 변경** (특히 차단 추가/제거)
- **새 라우트 트리** (예: `/docs/`, `/about/`, `/sponsors/`)
- **외부 시스템 연동** (분석, 댓글, 검색, CMS)
- **`docs/redaction-checklist.md` 약화 제안** — 항목 추가는 OK, 항목 삭제·
  완화는 사용자 결정
- **인테이크 표준 변경** (`docs/intake-template.md`의 필수 필드 변경)
- **상위 워크스페이스 `.gitignore`/inventory/ownership 갱신** — 이건 상위
  워크스페이스 PR로만

## Architecture boundaries

- 새 Content Collection 추가 시 `src/content.config.ts` 스키마 동시 작성.
  스키마 없는 컬렉션 금지.
- 모든 포스트 페이지는 `SchemaOrg.astro`를 통해 JSON-LD 주입. 페이지가
  schema 없이 빌드되면 리뷰 차단.
- 게시물은 컬렉션 디렉토리에만 둔다 — 기술 블로그는 `src/content/blog/`,
  서비스 블로그는 `src/content/stories/`. `src/pages/posts/`나 임의 위치 금지.
- raw 인테이크 원본은 제안 팀 private repo의 `docs/blog-intake/`에 있고,
  `docs/intake/from-<team>/`에는 redaction 통과한 **정제본**만 둔다
  (`sourceIntake:`가 가리키는 경로). 다른 곳에 옮기지 말 것.
- 정적 에셋은 `public/` 또는 글별 `_assets/`. 글로벌 에셋이 폭증하면 PR.

## Forbidden actions

- `wrangler deploy`, `wrangler delete`, `wrangler r2 ...`, `wrangler secret put`
  — 모두 사용자.
- `gh pr merge`, `git push --force` to main, GitHub repo 설정 변경
  (visibility, branch protection) — 모두 사용자.
- `npm publish` (이 repo는 publish 대상이 아님).
- 인테이크 원본의 **무가공 복붙**으로 게시. 반드시 redaction + 편집 후 게재.
- 시크릿/토큰/사내 호스트명/실 IP/실 클러스터 이름의 본문 노출.
- 게시물에 사용자 행동 추적 코드 임의 삽입.
- `editorial-policy.md`나 `redaction-checklist.md`를 콘텐츠 PR과 한 묶음으로
  완화 (정책 변경은 별도 `docs/<topic>` PR).
- 상위 워크스페이스(`~/Documents/ascendy/`) 파일 직접 편집. 필요한 변경은
  상위 워크스페이스 세션에 핸드오프.

## Verification

게시 PR을 "완료"로 보고하기 전에:

```bash
# 1) 콘텐츠 스키마/타입 검사
pnpm check

# 2) 빌드 성공 확인
pnpm build

# 3) 로컬에서 렌더 확인 — JSON-LD가 <head>에 들어갔는지 view-source로
pnpm preview
# 별도 터미널: curl -s http://localhost:4321/blog/<slug>/ | grep -A2 'application/ld+json'

# 4) redaction grep — §0의 패턴 한 번 더
grep -REi 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|BEGIN .*PRIVATE KEY' src/content/blog/

# 5) 사이트맵에 새 글이 들어갔는지 (빌드 후)
grep '<slug>' dist/sitemap-*.xml
```

PR 본문에 위 검증 결과를 한 줄씩 적는다. 통과 못한 항목이 있으면
`redactionReviewed: false`를 유지.

## Three-way roles (Claude + Codex + 사용자)

상위 워크스페이스와 동일한 3자 모델을 그대로 계승한다:

- **Claude (이 세션) + Codex**: 두 명의 시니어 편집자. 기술/편집 판단을
  근거 기반으로 논쟁한다. 합의되면 합의, 안 되면 양쪽 입장을 그대로
  사용자에게 노출.
- **사용자**: 최종 결정자 (비즈니스/공개 가시성/스타일 톤).

사용자에게 글을 올릴 때:

- "어떻게 할까요?"로 결정을 떠넘기지 말 것. A/B/C 옵션과 트레이드오프를
  제시.
- 외부 인용 가능성, redaction 위험, SEO/LMO 효과를 함께 평가.
- Claude/Codex가 끝까지 갈리면 둘의 의견을 모두 보존.

merge는 사용자만. `gh pr merge`는 어떤 에이전트도 실행하지 않는다.

## Pair with Codex (calibration window)

블로그팀 Codex는 동일 cmux workspace의 다른 surface에서 동작.
[`AGENTS.md`](./AGENTS.md) 참조. 운용 규칙:

- 동일 인테이크/PR에 대해 **독립** 작업 — 한쪽이 다른 쪽을 기다리지 않음.
- Codex 리뷰가 오면 **현재 상태 대비 검증** 후 동의/반대/유보를 나눠 회신.
- 강한 단정("절대", "항상", 구체 수치)은 근거 인용 요구.
- Codex가 자기 scope를 확장(예: 인테이크 형식 자체 변경)하려 들면 즉시
  지적.
- 합의 ≠ 동의. 끝까지 갈리면 사용자에게 분기 그대로 보고.

## Cross-repo / 인테이크 워크플로

인테이크는 **두 단계 경로**를 거친다 (블로그는 public, 3팀 repo는 private
이므로 raw 소스가 public에 닿지 않게 하기 위함 — 자세한 근거는
`docs/editorial-policy.md` "인테이크의 공개 경계", `docs/intake-template.md`):

```text
# 1) raw 원본 — 제안 팀의 private repo에 (블로그팀은 읽기 전용 열람):
<팀 private repo>/docs/blog-intake/<YYYY-MM-DD>-<topic>.md

# 2) 정제본 — 블로그팀이 redaction 통과 후 이 public repo에 커밋:
docs/intake/from-backend/<YYYY-MM-DD>-<topic>.md
docs/intake/from-frontend/<YYYY-MM-DD>-<topic>.md
docs/intake/from-infra/<YYYY-MM-DD>-<topic>.md
```

`sourceIntake:`는 2)의 정제본 경로를 가리킨다. 일일 주기·통지는
`docs/intake-standing-order.md` 참조.

### 조율(coordination)은 GitHub Issues로

**non-intake 조율 — 핸드오프·답신·상태 — 은 마크다운 파일이 아니라 GitHub Issues로
한다** (상위 워크스페이스 Tier 3 결정 `ascendy-infra#68`, 채택 이슈 `ascendy-blog#83`):

- **수신 repo에 이슈를 연다.** 라벨 두 개 — `cross-repo` + `from-<sender>`
  (블로그가 보낼 때는 `from-blog`).
- **이력/수신 조회**는 `--state all`(기본은 open만 나옴)과 명시적 `--limit`(기본 30
  cap)을 둘 다 준다:

```bash
gh issue list --repo AscendyProject/ascendy-blog --state all --label cross-repo --limit 200
gh issue view <N> --repo AscendyProject/ascendy-blog --comments   # 전체 스레드
```

- **lifecycle**: open = 진행 중(작업 내내 열어둔다); **ack는 댓글로**("확인, X 진행")
  — ack하려고 close하지 않는다; **resolved일 때만 close**(완료/거절/대체/무대응).
  PR에서 `Fixes #N` + `AscendyProject/<repo>#N`으로 링크.

**편집 인테이크는 그대로 파일 기반이다(carve-out).** 위 두 단계 인테이크 경로
(`docs/blog-intake/` raw → `docs/intake/from-*/` 정제본 → 글 frontmatter `sourceIntake:`)는
*조율*이 아니라 *콘텐츠 소스 파이프라인*이라 Issues로 옮기지 않는다 (redaction 경계 때문).
오직 non-intake 조율만 Issues로 간다.

기존 `docs/requests/from-*` 등 파일 기반 핸드오프는 **역사 기록**으로 남긴다 — 새로
추가하지 않고, 새 조율은 이슈로 시작한다(no big-bang). 내구 기록(결정문·아이디에이션)은
git에 남긴다.

3팀의 작업 결과물을 가공하는 일이지, 3팀의 코드를 편집하는 일이 아니다.
**sibling repo의 파일을 직접 편집하지 않는다.**

## Meta changes

이 `CLAUDE.md`, `AGENTS.md`, `docs/editorial-policy.md`,
`docs/redaction-checklist.md`, `docs/intake-template.md`,
`.github/workflows/**` 변경은 메타 PR로 분리:

- 브랜치: `docs/<topic>` 또는 `chore/<topic>`
- Codex 리뷰 mandatory (calibration window)
- 사용자 머지

콘텐츠 PR과 메타 PR을 한 묶음으로 보내지 않는다.

## cmux

블로그팀 Claude(이 세션)와 블로그팀 Codex가 같은 cmux workspace를 공유할
가능성이 큼. 상위 워크스페이스의 cmux 안전 규칙 그대로 계승:

- 다른 에이전트 surface에 **Enter를 사용자 동의 없이 누르지 않는다**
  (`cmux send-key Enter` 금지).
- `cmux send`에 `\n`/`\r` 포함 금지 — Enter로 해석됨. 멀티라인은 파일에
  저장 후 경로 전달.
- 타깃 surface는 `cmux tree` + `cmux read-screen`으로 사전 확인.

## See also

- [`README.md`](./README.md)
- [`AGENTS.md`](./AGENTS.md) — Codex의 짝 가이드
- [`docs/editorial-policy.md`](./docs/editorial-policy.md) — 기술 블로그
- [`docs/service-blog-policy.md`](./docs/service-blog-policy.md) — 서비스 블로그(`/stories/`)
- [`docs/redaction-checklist.md`](./docs/redaction-checklist.md)
- [`docs/intake-template.md`](./docs/intake-template.md)
- 상위: `../CLAUDE.md`, `../AGENTS.md`, `../docs/agent-os/risk-policy.md`
