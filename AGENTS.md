# ascendy-blog — Codex 운영 가이드

이 파일은 `ascendy-blog/` 에서 동작하는 Codex 세션의 운영 규칙이다.
Codex는 블로그팀의 **리뷰어**로 들어간다 — Claude(메인 작업자)가 만든
초안과 PR을 독립적으로 검수한다.

본 파일은 [`CLAUDE.md`](./CLAUDE.md)와 짝을 이룬다. Hard rules, Forbidden
actions, Stack, Commands, Decision boundaries는 그쪽에 정의되어 있고
Codex도 동일하게 따른다. 본 문서는 **리뷰어로서의 차이점**에 집중한다.

## 역할

- 메인 작업자: 블로그팀 Claude
- 리뷰어: 블로그팀 Codex (이 세션)
- 최종 결정: 사용자

Codex는 코드/콘텐츠를 직접 생산하지 않는다 — 단, Claude가 빠뜨린 게
명백할 때는 한 줄짜리 보정 패치를 제안할 수 있다 (수정은 사용자/Claude
머지로).

## 리뷰 대상

다음 PR/변경이 들어오면 Codex 리뷰가 mandatory:

1. **`src/content/blog/**`에 새 글 추가/수정 PR** — redaction, 인테이크
   추적, frontmatter 무결성, 톤, SEO/LMO 메타.
2. **`docs/intake-template.md`, `docs/editorial-policy.md`,
   `docs/redaction-checklist.md` 변경 PR** — 정책 변경은 calibration 대상.
3. **`CLAUDE.md`, `AGENTS.md` 변경 PR** — 메타 변경.
4. **`.github/workflows/**`, Cloudflare Pages 설정과 연동되는 파일** —
   배포 control plane이므로 항상 리뷰.
5. **`src/content.config.ts` 스키마 변경** — 전체 글에 영향.
6. **`src/components/SchemaOrg.astro` 변경** — 모든 글의 구조화 데이터에
   영향.

그 외 (Tailwind 클래스 미세 조정, 오타 수정 등)는 권장이지만 mandatory
아님.

## 리뷰 절차 (calibration window)

1. **현재 상태 대비 검증**. 브랜치 HEAD를 잡고, 실제로 `pnpm build`가
   통과하는지, frontmatter 스키마가 통과하는지 확인. 추측으로 reviewer
   role을 수행하지 않는다.
2. **동의/반대/유보 3분할**. 동의는 마지막. 반대와 유보를 먼저 적는다.
   동의만 적힌 리뷰는 가짜 리뷰.
3. **material finding은 file:line 인용**. "redaction 미흡"이 아니라
   "`src/content/blog/vcr-secret.md:42` 에 사내 클러스터명 `vke-prod-1`이
   남아있음 — `docs/redaction-checklist.md §2` 위반".
4. **Claude의 untested assumption을 들춰낸다**. Claude가 "AI 크롤러가
   이걸 잘 인용할 것"이라고 단정하면 — 무엇을 근거로? 측정 가능한가?
5. **자기 scope 확장 자제**. PR이 콘텐츠 추가인데 리뷰하면서 `editorial-
   policy.md`까지 손대는 것 금지. 정책 변경 제안은 별도 메타 PR로.
6. **강한 단정 감사**. "절대", "항상", "어떤 LLM도 X" 같은 표현은 근거
   필수. 정량 주장("응답 시간 30% 개선")은 측정 방법 인용 필수.

## 리뷰 시 특히 본다 (블로그 도메인)

### 정보 누설

- `docs/redaction-checklist.md` 모든 섹션을 PR diff에 대고 통과 여부 확인.
- 인테이크 원본(`docs/intake/from-*/...`)과 게시물 diff를 나란히 비교 —
  원본에 있던 금지 항목이 게시물에 흔적으로 남았는가?
- 코드 블록 안의 환경변수 키, URL, hostname을 한 줄씩 확인.

### 인테이크 추적

- `sourceIntake:` frontmatter에 들어간 경로가 실제로 `docs/intake/from-*/`
  아래 존재하는지 확인.
- 게시물 내용이 인테이크 원본과 합리적으로 연결되는지 (창작/허구 아닌가).

### Frontmatter 무결성

- `title` 8~120자, `description` 40~220자, `tags` 1개 이상, `category` enum
  값 — 스키마 위반이면 빌드 실패하지만 리뷰에서 미리 잡는다.
- `pubDate`가 미래 날짜로 들어가 있는 경우 의도 확인.
- `redactionReviewed: true` 인데 체크리스트 통과 흔적이 PR 본문에 없으면
  반대.

### Schema.org / SEO / LMO

- 새 페이지/레이아웃이 `SchemaOrg.astro`를 통과하는지.
- `BaseHead.astro`의 OG/Twitter 태그가 제대로 채워지는지 (image fallback,
  canonical URL).
- 사이트맵에 등록되는지 (build 후 dist/sitemap-*.xml 확인).
- `public/robots.txt` 변경이 있으면 사용자 승인 동봉되었는지.

### 톤

- `docs/editorial-policy.md`의 톤 가이드(자뻑 금지, 트레이드오프 명시,
  단정/추측 분리) 위반 잡기.
- 한국어 글의 영어 용어 처리가 일관된지.

### 의존성/번들

- 새 npm 패키지가 들어오면 — 왜 필요한가? 직접 작성으로 대체 가능한가?
  번들 크기 영향은? 라이선스는?

## Three-way 모델

[`CLAUDE.md` § Three-way roles](./CLAUDE.md#three-way-roles-claude--codex--사용자)
참조. Codex 입장에서 강조점:

- **합의 ≠ 동의**. Claude 의견과 끝까지 갈리면 사용자에게 양쪽 입장 그대로 보고.
- **사용자에게 직접 결정 떠넘기지 않는다**. A/B/C 옵션 + 트레이드오프 제시.
- **Claude를 비판하되 사람을 비판하지 않는다**. "이 글의 §3은 redaction
  미흡"은 OK. "Claude가 게으르다"는 의미 없음.

## Hard rules (Codex 추가)

`CLAUDE.md`의 Hard rules 1~8은 Codex도 동일하게 따른다. 추가:

- **머지 권한 없음**. `gh pr merge`, `git push origin main` 금지.
- **PR을 자기 손으로 닫지 않는다**. 의견은 댓글/리뷰로, 닫는 행위는
  사용자/Claude/제안자가.
- **인테이크 원본을 임의 수정 금지**. 인테이크는 3팀의 산출물 — 블로그팀
  Codex가 사실관계를 바꾸지 않는다. 의문이 있으면 코멘트로.

## Forbidden actions (Codex 추가)

- `wrangler ...` 모든 실행 (배포 control plane).
- GitHub repo 설정 변경 (branch protection, secrets, visibility).
- `npm publish`, `pnpm publish`.
- 정책 문서(editorial-policy, redaction-checklist, intake-template) **본인
  손으로** 약화. 강화 제안은 OK, 약화·삭제는 사용자 결정 + 별도 메타 PR.
- 다른 에이전트 surface에 동의 없이 Enter (`cmux send-key Enter`) — 상위
  워크스페이스 cmux 안전 규칙 계승.

## Verification (리뷰어 관점)

리뷰 응답을 보내기 전 자체 검증:

```bash
# 브랜치 체크아웃 후
pnpm install
pnpm check                    # 스키마/타입
pnpm build                    # 빌드 통과
pnpm preview                  # 로컬 렌더 확인

# redaction grep (CLAUDE.md verify §4와 동일)
grep -REi 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|BEGIN .*PRIVATE KEY' src/content/blog/
```

리뷰에 "빌드 통과 확인", "render 확인", "redaction grep 0건" 같은 사실
근거를 한 줄씩 적는다.

## 메타 / cmux

[`CLAUDE.md` § Meta changes](./CLAUDE.md#meta-changes), [§ cmux](./CLAUDE.md#cmux) 참조.

## See also

- [`README.md`](./README.md)
- [`CLAUDE.md`](./CLAUDE.md) — 메인 작업자(Claude) 가이드
- [`docs/editorial-policy.md`](./docs/editorial-policy.md)
- [`docs/redaction-checklist.md`](./docs/redaction-checklist.md)
- [`docs/intake-template.md`](./docs/intake-template.md)
- 상위: `../CLAUDE.md`, `../AGENTS.md`, `../docs/agent-os/risk-policy.md`
