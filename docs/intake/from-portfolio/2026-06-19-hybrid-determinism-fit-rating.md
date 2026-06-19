---
team: portfolio
date: 2026-06-19
topic: "하이브리드 결정론 심화 — /fit·/rating: 결정론이 등급/점수 밴드를 잠그고 LLM은 밴드 안에서만 판단. 재현성 보장은 밴드이지 temperature가 아니다. /rating은 percentile 거부(구조적 — 모집단 데이터 없음). portfolio 밖에서도 재사용 가능한 패턴."
suggestedCategory: "meta"
suggestedTags: ["grounding", "ai", "determinism", "evaluation", "developer-tools"]
source: "portfolio 팀 5부작 글감 ④/fit·⑤/rating(docs/requests/from-portfolio/)의 합본 정제본. 캐논은 public repo gh로 직접 검증."
redactionReviewed: true
---

> portfolio 팀 raw 글감(④ cmd-fit-deterministic-grade, ⑤ cmd-rating-bounded-agent)의 합본 정제본.
> **Class A/B 없음** — 전부 public OSS(`AscendyProject/portfolio`, Apache-2.0). 아래 수치·동작은
> 2026-06-19 현재 main 코드에서 gh로 직접 확인(글감 작성 시 v0.0.1 → **현재 v0.2.0**, /fit·/rating
> 핵심 메커니즘은 동일하게 유지). **편집 지침:** 본문은 `/rating`의 *출하된* percentile 거부만
> 다루고, 출하되지 않은 방향성은 언급하지 않는다(이 정제본도 public이므로 미출하 전략을 적지 않는다).

## 검증된 캐논 (gh, 2026-06-19, main)

- 버전 **0.2.0**, Apache-2.0. 커맨드 `/fit`·`/rating` 모두 main 출하(PR #12·#11).
- **`/fit` (`fit/score.py`):** 결정론.
  - coverage% → 등급: `COVERAGE_CUTOFFS` S≥90, A≥75, B≥55, C≥35, 그 외 D.
  - 등급 → score band: `GRADE_BANDS` S=(96,100), A=(85,95), B=(70,84), C=(55,69), D=(0,54).
  - 모델 호출 없음 → 같은 포트폴리오+JD면 항상 같은 등급/밴드.
- **`/fit` (`fit/grade.py`):** 에이전트가 잠긴 밴드 안에서만 점수 + 근거. 점수는 밴드로 clamp, un-grounded 근거 drop. 모델은 등급을 못 바꿈.
- **`/rating` (`rating/profile.py`):** 결정론. 증거 메트릭 3차원, 각 메트릭이 계산된 evidence ref 인용:
  - volume(머지 PR 수): High 20+ →2pt, Steady 5–19 →1pt, Low 0–4 →0pt
  - breadth(distinct 변경 파일): Wide 30+ →2, Moderate 10–29 →1, Narrow 0–9 →0
  - stack diversity(distinct 언어, 고정 확장자→언어 표): Polyglot 4+ →2, Versatile 2–3 →1, Focused 0–1 →0
  - points 합 → 등급(하한 임계값 순회): ≥6→S, ≥4→A(4–5), ≥2→B(2–3), ≥1→C, 0→D. 같은 GRADE→band.
- **`/rating` (`rating/grade.py`):** temperature=0 grader, 밴드 clamp, 근거 bullet의 `evidence_refs ⊄ portfolio.evidence`면 drop, malformed 응답은 밴드 midpoint + safe reasoning(크래시·날조 ref 없음).
- **percentile 거부 (`rating/render.py` + `tests/test_rating.py`):** 설계·프롬프트 차원의 거부. 모집단 데이터가 없으니 *정당한* percentile은 계산되지 않고, 프롬프트가 그 표현을 금지하며, 결정론 렌더러 자신의 출력(템플릿 + "not a position in any population" 면책 문구)엔 percentile 어휘가 없다. `test_no_percentile_lexicon_in_rendered_output`가 기본 fake-grader 렌더 출력에 "top "/"%ile"/"percentile"/"rank" 등 부재를 확인한다(회귀 테스트). **단, 모델이 쓴 reasoning 텍스트는 사후 검증하지 않는다** — render는 `grade_result.reasoning` bullet text를 필터 없이 append하므로, 모델이 근거 없이 "top 1%"를 쓰면 출력에 남을 수 있다. 따라서 "렌더러가 어휘를 막는다/테스트로 강제/구조적으로 불가능"이라고 쓰면 과장. **한정 표현:** "정당한 percentile 계산 불가(모집단 데이터 없음) + 프롬프트 금지 + 렌더러 자신은 안 내보냄 + 회귀 테스트가 기본 출력 확인. 단 모델 reasoning 사후 검증 없어 출력 부재는 보장 못 함."

## 앵글 (재사용 가능한 패턴)

- 한 줄 펀치: **"결정론이 범위를 잠그고, LLM은 그 안에서만 판단한다."** LLM 일관성 문제에 대한 재사용 가능한 패턴 — portfolio 밖에서도 적용 가능(보편해 증명은 아님, N=2 인스턴스).
- 핵심 통찰: **재현성의 보장은 밴드(결정론적으로 잠김)이지 temperature가 아니다.** temperature=0은 seam에서 best-effort로 전달될 뿐. 모델이 흔들려도 *티어를 넘어 과장할 수 없다.*
- /fit·/rating은 같은 패턴의 두 인스턴스 — 차이는 등급의 *입력*(JD coverage vs 자기 증거 메트릭).
- 톤 캡스톤: /rating이 "상위 X%"를 **안 하는** 것 — 모집단 데이터가 없어 말하면 곧 지어내기. "덜 약속하고 정확히 지킨다."

## 런칭 글과의 차별 (중복 회피)

런칭 글(`portfolio-public-launch`)은 5커맨드를 *소개 깊이*로만 다뤘다. 이 글은 /fit·/rating에 한해
**실제 컷오프·밴드·points 수치, 재현성=밴드 통찰, 방어 디테일**까지 들어가는 심화편.

## 외부에 공유하면 안 되는 부분 (redaction)

- `/rating`의 *출하되지 않은* 방향성 일체 — 언급하지 않는다(이 정제본도 public). 본문은 **출하된 거부 동작만**.
- 데모 캡처 쓰면 실제 JD/회사명·로컬 경로·실명 핸들 가릴 것(글감엔 없음).
- 시크릿·사내 호스트·경로 없음(전부 public OSS 캐논).
