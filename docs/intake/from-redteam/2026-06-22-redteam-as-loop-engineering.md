---
team: redteam
date: 2026-06-22
topic: "루프 엔지니어링(프롬프트→컨텍스트→하네스→루프, 2026.6 메인스트림)의 심장은 *검증 게이트*다('verifier가 있어야 자리를 비운다', maker/checker). redteam은 그 검증을 cross-provider 적대 + fail-closed로 가장 진지하게 구현한 루프 사례. 운영자 지정 주제 + 웹 검증(루프 용어) + gh 검증(redteam 캐논)."
suggestedCategory: "meta"
suggestedTags: ["loop-engineering", "agents", "adversarial-review", "redteam", "oss"]
source: "운영자 지정 주제. 루프 엔지니어링 계보/정의는 web 검증(Cobus Greyling, explainx 등). redteam 캐논은 public repo gh 검증."
redactionReviewed: true
---

> 운영자 지정 주제의 정제본. **Class A/B 없음** — redteam은 public OSS(`AscendyProject/redteam`, Apache-2.0),
> 루프 엔지니어링은 공개 용어. **정직성:** "redteam이 루프 엔지니어링의 *가장 발전된/유일한* 형태"라고
> 단정하지 않는다 — 루프의 *심장(검증)*을 cross-provider 적대로 가장 진지하게 구현한 *한 사례*(N=1,
> 벤치마크 아님)로 한정. 운영자의 *주장/포지셔닝*임을 밝히고, 4-결함 적발은 CHANGELOG 1차 확증.

## 루프 엔지니어링 캐논 (web 검증)

- 계보: **프롬프트 → 컨텍스트(2025, Tobi Lütke/Anthropic) → 하네스(2026 초) → 루프(2026.6 메인스트림).**
  ([Cobus Greyling](https://cobusgreyling.medium.com/loop-engineering-62926dd6991c), [explainx](https://explainx.ai/blog/what-is-loop-engineering-ai-agents-2026))
- 정의: *턴마다 직접 프롬프트* 대신 **루프(시스템)를 설계** — 작업 발견 → 에이전트(종종 서브에이전트)에 위임 → 검증 → 상태 보존 → 다음 행동 결정, *스케줄/목표까지*.
- 구성요소: ① 트리거/자동화(heartbeat) ② **검증 가능한 목표** ③ 액션/툴 ④ **검증 게이트** ⑤ 메모리/상태 보존 (+ 워크트리 병렬, 서브에이전트 maker/checker).
- 핵심 원칙(1차 인용):
  - **"무인 루프에서, verifier가 있어야 자리를 비울 수 있다."** ← 검증이 루프의 심장.
  - **"코드를 쓴 에이전트는 자기 일의 나쁜 심판이다"**(maker/checker 분리, *다른* 모델·다른 지시로 검증).
  - "검증이 없으면 루프는 영원히 돌거나 너무 일찍 멈춘다." / "막연한 목표는 막연한 루프를 만든다."
  - "인지적 항복(cognitive surrender) 금지" — 사람이 판단을 통째로 위임하면 안 됨.

## redteam → 루프 구성요소 매핑 (gh 검증, v0.5.1·Apache-2.0)

- **트리거/자율:** common path에 human gate 없이 도는 agent-pair 루프 + **auto-merge**("적대적 페어 + 검증 *자체*가 신뢰"). headless `claude -p --permission-mode plan` 리뷰어.
- **검증 가능한 목표:** 고정 pipeline `plan → implement → review_code → create_pr`; TDD 모드는 `write_test → verify_test`를 front-load(테스트가 목표를 checkable하게).
- **검증 게이트(★ 핵심):** "*다른* 모델이 diff를 **적대적으로** 리뷰" — 기본 예: **Codex가 쓰고 Claude가 리뷰**(또는 반대). **self-review guard**가 *같은 프로바이더* 자기리뷰를 **fail-closed로 거부**. findings는 pass/fail이 아니라 **tiered**. → 루프 엔지니어링이 말하는 maker/checker를 *cross-provider 적대*로 끝까지 민 형태.
- **메모리/상태:** 각 phase 후 **`state.json` 영속**(dispatch-time 스냅샷 invariant); 길거나 detached run용 운영자 progress 화면.
- **fail-safe/정지조건:** blocker가 review 라운드를 넘겨 지속되면 **`human_gate_rescue`** → PR 전에 사람 검토. **reviewer fallback ladder**(1차 리뷰어가 *인프라*로 실패하면 fail-closed로 degrade).
- **위험별 라우팅:** **tier-aware routing**(opt-in `config.toml`) — guarded/strategic 변경엔 사람 게이트·롤백 플랜을 add-back(인지적 항복 방지와 정확히 일치).
- **루프 설계 = '안 만들기'도 포함:** in-session **서브에이전트 리뷰어 어댑터를 *거부***(#37/#67 CLOSED, 결정문 PR #68 머지) — 같은 프로바이더 자기리뷰 붕괴 위험 때문에 headless cross-provider를 택함. ([기능을 거부하는 법](/blog/how-to-reject-a-feature/))

## 받침 증거 (gh)

- 4-결함 적발: "cross-provider adversarial review가 머지 전 real HIGH 결함 4개를 잡았다"(CHANGELOG 0.3.0). self-review가 rubber-stamp할 종류를 *다른* 모델이 잡은 사례.
- 버전 v0.5.1, Apache-2.0. README가 위 매핑 키워드 전부 명시.

## 앵글

- **루프가 자율적일수록 verifier가 전부다** — 그리고 verifier가 *같은 모델/프로바이더*면 self-review로 조용히 무너진다(이번 세션 [who-does-ai-replace]의 "AI는 너에게 동조한다"와 같은 결).
- 그래서 루프 엔지니어링의 *다음 프론티어*는 **cross-provider 적대 검증**이고, redteam은 그걸 엔진 레벨로 박은 사례.
- 정직: 최고/유일 단정 금지. "검증을 cross-provider 적대로 가장 진지하게 구현한 한 사례"로.

## 외부 공유 불가

- 없음(전부 public OSS·공개 용어). 시크릿·사내 경로 없음.
