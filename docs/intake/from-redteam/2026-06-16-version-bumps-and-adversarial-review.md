---
team: redteam
date: 2026-06-16
topic: "redteam 0.2→0.3 버전이 말하는 '신뢰를 얻는 과정', 그리고 킬러 증거 — 교차-프로바이더 적대적 리뷰(Codex가 Claude가 쓴 코드를 리뷰)가 0.3.0 사이클에서 머지 전 HIGH 결함 4개를 잡았다. CHANGELOG가 그 사실을 직접 명시. N=1 정직 단서 포함."
suggestedCategory: "meta"
suggestedTags: ["adversarial-review", "ai-agents", "code-review", "redteam", "trust", "semver"]
redactionReviewed: true
---

> redteam 팀 raw 글감의 정제본. **Class A/B 없음** — 전부 public OSS(`AscendyProject/redteam`,
> Apache-2.0). 캐논은 공개 CHANGELOG·README·issue/PR에서 직접 확인. 시크릿·키·사내 호스트·경로 없음.
> AGPL→Apache는 정정 완료(현재 Apache-2.0). 헤드라인("4 HIGH 결함")은 CHANGELOG로 1차 확증,
> 4개 결함의 세부 mechanic은 redteam 팀 계정(발행 전 fact-check 제안 있음).

## 무엇이고 왜 (앵글)

redteam은 적대적 *에이전트-페어* 하네스다 — 한 모델이 test-first 파이프라인으로 코드를 쓰고,
**다른 독립 모델**이 그 diff를 적대적으로 리뷰하고, 사람은 비가역 단계만 게이트한다. 그리고
**자기 자신을 dogfood한다**(자기 파이프라인으로 개발됨).

### 앵글 A — 버전 번호가 곧 이야기

- **0.1.0 — 존재한다.** OSS repo로 추출, 비-Python 스택에서 generic 검증, Claude Code 플러그인 패키징, tier-aware routing.
- **0.2.0 (2026-06-14) — 의견(능력)을 갖는다.** thesis를 코드로 박은 기능들: **same-provider self-review를 fail-closed로 거부**(#28 — 하네스가 *자기 프로바이더의* 코드를 리뷰하는 걸 거부), `/redteam` 커맨드 + one-shot cross-model `review` 서브커맨드(#29), 설치 시 하네스 자기 config 보호 플래그, pipeline-mode 검증.
- **0.3.0 (2026-06-16) — 자기 자신을 견딘다(resilience).** 펀치라인: 0.2 능력을 *쓰면서*(dogfooding) 실패 가능 지점이 다 드러났고, 0.3은 거의 전부 **fail-closed backstop + 운영자 가시성**이다:
  - **reviewer fallback ladder**(#37 step 4) — 리뷰어 CLI가 인프라로 실패(없음/미인증/타임아웃/파싱불가)하면 안전하게 degrade(기본 `manual`=fail-closed). *유효한* 리뷰 결정(CHANGES_REQUESTED 포함)은 fallback 트리거가 아님.
  - **dispatch-time pre-implement snapshot invariant**(#39) — 검증 스냅샷이 완전히 pin되기 전엔 implementer가 트리를 못 건드림.
  - **install version stamp + `--check`**(#34) — vendored 복사본이 source보다 뒤졌는지 알림.
  - **per-task operator `progress.md`**(#49) — 길거나 detached run의 secret-safe 상태 미러(gitignore, PR에 커밋 안 됨).
  - "fail closed, don't fail open" 픽스 묶음(#40 config load, #50 uncommitted scope, #51 PR auth preflight).

**throughline:** v0.2는 "기능이 동작한다", v0.3은 "그 기능이 *드러낸* 현실의 난장을 견딘다". 에이전트가 만든 SW에선 이 간극이 전부다 — happy path 버전은 쉽고, 실패 상황에서 *틀린 일을 거부하는* 버전이 믿을 수 있는 버전이다.

### 앵글 B (킬러 증거) — 한 AI의 PR을 다른 AI가 리뷰했더니 HIGH 4개

0.3.0 사이클에서, 한 AI 에이전트가 쓴 PR 묶음을 **다른-프로바이더** 모델이 PR별로 적대적 리뷰했다(하네스 자신의 전제를, 하네스 자신의 개발에 적용). 에이전트가 쓴 코드는 진짜로 좋았지만, 교차-프로바이더 리뷰어가 **머지 전 real HIGH 결함 4개**를 잡았다 — 전부 같은 모양: *~95% 맞는데, 보안/정합성 디테일 하나가 빠짐.* (CHANGELOG 0.3.0이 이 사실을 직접 명시.) 공개 예(전부 repo에):

1. **pre-implement snapshot 강화(issue #39 → fix)**가 강화 대상의 **필드 하나를 빠뜨려** 부분 상태가 게이트 전에 트리를 변형할 수 있었음(구멍을 막는다는 fix에 정확히 구멍이).
2. **operator progress 파일(#49)**이 **raw 리뷰어 줄**(시크릿을 인용할 수 있음)을 사람이 읽는 파일에 미러 → 구조적·bounded 필드만 렌더하도록 수정.
3. **commit-integrity gate(#50)**에서 **실패한 git probe가 'clean'으로 읽힘** — fail-closed가 일인 게이트에서 fail-open.
4. **PR-auth preflight(#51)**가 **credential 박힌 remote URL/stderr**를 persist 상태로 누출.

**앵글:** 넷 다 멍청한 버그가 아니다 — 유능한 작성자(사람이든 AI든)가 happy path 통과 + 테스트 초록이라 출하하는 종류다. 그리고 정확히 *자기 출력을 리뷰하는* 모델이 rubber-stamp하기 쉬운 종류다. **작성자의 추론에 blind하고 refute하도록 프롬프트된 *다른* 모델**이 넷 다 잡았다 — 벤치마크가 아니라 프로젝트 자신의 merge log다.

**정직 단서(꼭 유지):** 이건 N=1 프로젝트의 한 사이클이지 통제된 연구가 아니다. 주장은 "여기서 진짜, 찾기 비싼 결함을 잡았다"지 "통계적으로 우월함이 증명됐다"가 아니다.

### 앵글 C (선택, 짧은 SemVer 설명)
- 새 backward-compatible 능력 추가 → minor. 순수 버그픽스는 patch지만 같은 릴리스에 기능과 함께 나가 전체는 minor.
- major가 될 것: "vendor-and-run" 계약이나 config 스키마를 깨는 변경. 0.2/0.3은 안 깸.
- pre-1.0 단서: SemVer상 `0.x`는 안정성 약속이 없음. redteam은 그래도 minor를 "기능 추가, 무파괴"로 다루고 CHANGELOG에 행동 변화를 명시 — "1.0 이후처럼 버전하되, 안 그럴 권리는 보유".

## 캐논 (검증됨, 추측 금지)
- repo: `github.com/AscendyProject/redteam` (public, **Apache-2.0**).
- 릴리스: v0.1.0 / v0.2.0(2026-06-14) / v0.3.0(2026-06-16). CHANGELOG가 authoritative.
- 결함 issue #39/#49/#50/#51(전부 CLOSED) → fix PR #58/#59/#52/#56(머지됨). #37은 **OPEN issue**(fallback ladder step만; sub-agent adapter·멀티플렉서 스크린스크래핑 거부는 미구현 = 로드맵).
- 헤드라인 "교차-프로바이더 리뷰가 머지 전 HIGH 결함 4개 적발"은 CHANGELOG 0.3.0에 직접 기재.

## 주장하면 안 될 것
- sub-agent reviewer adapter나 멀티플렉서-transport가 "있다"고 쓰지 말 것 — #37은 fallback-ladder step까지만.
- 4-결함을 벤치마크/일반적 우월성 증명으로 제시하지 말 것 — 한 프로젝트의 증거, 그대로 명시.

## 외부에 공유해도 좋은 부분 / 안 되는 부분
- 좋음: 위 캐논 전부(public OSS). 버전 arc, 교차-프로바이더 리뷰 패턴, 4-결함의 "~95% 맞고 디테일 하나" 모양.
- 안 됨: 시크릿·키·사내 호스트·경로(이 글감엔 없음). N=1을 통계적 증명으로 과장 금지.
