# 인테이크 상시 지침 — OSS 프로젝트판 (Standing Order, OSS)

`AscendyProject`의 **공개 OSS 프로젝트**(현재 `redteam`, `portfolio`, 이후 추가될
OSS repo)를 위한 블로그 글감 공급 상시 지침이다. 블로그팀(편집국)이 OSS 에이전트에
보내는 요청이고, 각 OSS 프로젝트는 이 지침을 자기 repo의 운영 가이드
(`CLAUDE.md` / `AGENTS.md`)에 standing order로 반영해 운용한다.

> 이 문서는 backend/frontend/infra 3팀용 [`intake-standing-order.md`](./intake-standing-order.md)의
> **OSS 변형**이다. 다른 점은 단 하나 — **드롭 위치**. 나머지(포맷·민감정보 표시·
> 특별 트리거·이후 흐름)는 3팀 지침과 동일하다. 두 문서가 충돌하면 OSS 프로젝트
> 경로의 일은 이 문서가 우선.

## 왜 OSS는 다른가 — raw를 자기 repo에 두면 안 된다

3팀은 **private repo**라서 raw 글감을 자기 repo의 `docs/blog-intake/`에 둔다.
OSS 프로젝트는 **public repo**다 — raw 글감(아직 redaction 안 된 원본)을 자기
repo에 커밋하면 **redaction 전 상태가 git history로 영구 공개**된다. 한 번
public이 된 commit은 force-push로도 완전히 못 지운다.

그래서 OSS 프로젝트의 raw 원본은 **자기 repo가 아니라 blog repo의 gitignored
로컬 경로**에 떨군다. blog repo는 public이지만 이 경로는 `.gitignore`에 등록돼
있어(파일 자체가 커밋되지 않음) raw가 public에 닿지 않는다. 블로그팀이 읽은 뒤
redaction을 통과시킨 **정제본만** `docs/intake/from-<project>/`에 커밋한다.

## 요청 (한 줄)

**각 OSS 프로젝트는 릴리스·머지·결정이 발생한 사이클마다, 블로그 글감 인테이크를
blog repo의 gitignored 드롭 경로에 떨군다.**

## 1. 어디에 — blog repo의 gitignored 로컬 경로

```text
ascendy-blog/docs/requests/from-<project>/YYYY-MM-DD-<kebab-topic>.md
예: ascendy-blog/docs/requests/from-redteam/2026-06-16-version-bumps.md
    ascendy-blog/docs/requests/from-portfolio/2026-06-16-grounding-harness.md
```

`docs/requests/`는 blog repo `.gitignore`에 등록돼 있다(파일이 커밋되지 않는
로컬 전용 경로). **자기 OSS repo에는 raw 글감을 두지 말 것.**

## 2. 무슨 형식으로

[`intake-template.md`](./intake-template.md)를 그대로 복사해 채운다. 핵심 필드:
`team`(=프로젝트명), `topic`, `suggestedCategory`(OSS 프로젝트 소개·패턴 글은
보통 `meta`), `suggestedTags`, `urgency`, `relatedPRs`, 그리고 본문의
"무엇을/왜 했나", "외부에 공유해도 좋은 부분", "공유하면 안 되는 부분".

## 3. 캐논 정직성 — public repo가 진실의 출처다 (OSS 전용 항목)

OSS 프로젝트는 캐논(라이선스·버전·issue/PR 번호·기능 상태)이 **공개 repo에서
누구나 검증 가능**하다. 그래서 글감의 사실관계가 실제 repo 상태와 어긋나면
발행 후 즉시 들통난다. **글감에 사실을 적기 전에 실제 repo 상태로 검증하라:**

- **shipped vs roadmap** — "있다/출하됐다"고 쓰는 기능은 `gh`로 머지 여부를
  확인하라. (실전 사고: portfolio 글감이 `/reference-check`를 "draft/미머지"로
  적었으나 실제로는 PR이 **이미 머지**였다.)
- **issue# vs PR# / OPEN vs CLOSED** — 결함·기능을 번호로 추적할 때 issue 번호와
  fix PR 번호, OPEN/CLOSED 상태를 정확히. (실전 사고: redteam 글감의 `#37`이
  "구현됨"처럼 읽혔으나 실제로는 **OPEN issue**(fallback-ladder 단계까지만,
  나머지는 로드맵)였다.)
- **라이선스·버전** — CHANGELOG / `LICENSE` / 릴리스 태그를 직접 보고 적는다.
  초기 표기와 현재가 다를 수 있다.

→ "글감에 적힌 대로"가 아니라 **"실제 repo 상태"**가 캐논이다. 애매하면
   "외부에 공유하면 안 되는 부분"이 아니라 본문에 "검증 필요"로 표시해
   블로그팀이 발행 전 fact-check하게 하라.

## 4. 민감한 건 숨기지 말고 표시

OSS는 코드가 이미 public이므로 시크릿 노출 위험은 3팀보다 낮다. 다만 글감
작성 중 **미공개 비즈니스 결정·고객 식별정보·아직 remediation 안 된 보안
갭**이 섞이면 "외부에 공유하면 안 되는 부분"에 명시한다. 숨기면 블로그팀이 못
걸러낸다 — 표시하면 우리가 제거·일반화한다. 최종 책임은 블로그팀.

## 5. 무엇이 글감이 되나

그 사이클의 작업 중 **결정·트레이드오프·인시던트 회피·패턴**이 있으면 글감이다.
OSS 프로젝트는 특히:

- "이 버전에서 무엇을, 왜 바꿨나 — 버린 대안과 함께" (릴리스 arc)
- "이런 결함을 이렇게 잡았다 / 이렇게 설계로 막았다"
- "이 도구가 푸는 한 가지 문제, 그리고 그걸 구조로 만든 방법"

순수 잡무(의존성 bump, 오타)는 제외. 진짜 글감이 없으면 `urgency: backlog`로
가벼운 메모만 남겨도 된다 — 억지로 만들지 말 것.

### 5-bis. 특별 트리거 — Claude↔Codex가 치열하게 갈렸던 토론

3팀 지침과 동일하게, **이건 적극적으로 찾아서 떨궈 달라.** 한 주제를 두고
Claude와 Codex(또는 두 에이전트/리뷰어)의 의견이 **3라운드 이상 substantive하게
갈렸다가 합의(또는 정직한 분기)에 이른** 경우. 필터 셋: ① 양쪽 다 방어 가능
(steelman), ② 실제 트레이드오프 존재(네이밍·스타일 고집 제외), ③ 수렴이
*원리*를 가르쳤나. 적을 것은 "합의함" 요약이 아니라 **긴장 그 자체** — 양쪽
입장 재현, 갈림의 crux, 수렴 경로. 자세한 기준은
[`intake-standing-order.md`](./intake-standing-order.md) §4-bis 참조.

## 6. 통지 (블로그팀이 어떻게 아나)

- **기본 (pull):** 블로그팀이 주기적으로 `docs/requests/from-<project>/`를 훑어
  새 파일을 가져간다. 별도 통지 없이도 수거된다.
- **급한 건 (push):** `urgency: urgent`거나 공개 시점이 정해진 글은, 같은 cmux
  workspace의 블로그팀 surface에 한 줄 핑하거나 알린다.

## 7. 이후 흐름 (블로그팀이 처리)

읽기 → redaction 체크리스트 통과 → 정제본을 `ascendy-blog/docs/intake/from-<project>/`에
커밋 → 게시물 작성(`sourceIntake:` = 정제본) → `draft:true/redactionReviewed:false`로
PR → Codex 리뷰 → 사람 머지 → Cloudflare Pages 자동 배포.

발행 주기는 블로그팀이 조절한다. 인테이크가 곧 발행은 아니다.

## See also

- [`intake-standing-order.md`](./intake-standing-order.md) — 3팀(private repo)판. §4-bis(토론 트리거) 등 공통 기준의 원본
- [`intake-template.md`](./intake-template.md) — 채울 양식
- [`editorial-policy.md`](./editorial-policy.md) — "인테이크의 공개 경계"
- [`redaction-checklist.md`](./redaction-checklist.md) — 블로그팀이 돌리는 체크리스트
