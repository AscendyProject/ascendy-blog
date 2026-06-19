---
title: "LLM 점수는 왜 못 믿나 — 결정론이 밴드를 잠그고, 모델은 그 안에서만"
description: "에이전트에게 점수를 맡기면 같은 입력에도 들쭉날쭉하다. portfolio의 /fit·/rating은 하이브리드로 푼다 — 결정론 코드가 등급과 점수 밴드를 잠그고(같은 입력=항상 같은 밴드), LLM은 그 안에서만 판단한다. 재현성의 보장은 밴드지 temperature가 아니다."
pubDate: 2026-06-19
author: "Ascendy Engineering"
tags: ["grounding", "ai", "determinism", "evaluation", "developer-tools"]
category: "meta"
lang: "ko"
translationKey: "hybrid-determinism-grading"
sourceIntake:
  - "docs/intake/from-portfolio/2026-06-19-hybrid-determinism-fit-rating.md"
draft: false
redactionReviewed: true
---

## TL;DR

- LLM에게 "이걸 점수로 매겨줘"라고 시키면 **같은 입력에도 점수가 흔들린다.** `temperature=0`도 그걸 보장하지 못한다.
- **portfolio**(grounded 포트폴리오 하네스, Apache-2.0, v0.2.0)의 `/fit`·`/rating`은 이걸 **2-tier 하이브리드**로 푼다 — *결정론 코드*가 등급과 점수 밴드를 먼저 잠그고, *LLM*은 그 밴드 **안에서만** 미세 점수를 낸다.
- 핵심 통찰 한 줄: **재현성의 보장은 밴드(결정론적으로 잠김)이지 temperature가 아니다.** 모델이 흔들려도 *티어를 넘어 과장할 수 없다.*
- 이건 portfolio만의 트릭이 아니라 **"LLM이 일관성 없는 점수를 낸다"는 문제의 일반해**다 — 다른 평가 시스템에도 그대로 옮길 수 있다.

> **소스 노트.** portfolio 팀 글감(커맨드 시리즈 ④/fit·⑤/rating)을 합쳐 정제한 글이다. 전부 public OSS(`AscendyProject/portfolio`)라 아래 컷오프·밴드·점수 수치는 2026-06-19 현재 main 코드에서 직접 확인했다. 같은 도구의 큰 그림은 [portfolio 퍼블릭 런칭 글](/blog/portfolio-public-launch/)에, 도구의 토대가 되는 grounding 원칙은 [그 소개 글](/blog/portfolio-harness-launch/)에 있다.

## 문제 — LLM에게 점수를 맡기면 일관성이 죽는다

"이 지원자의 역량을 0~100으로 매겨줘." LLM은 답을 준다. 그런데 **같은 입력으로 다시 물으면 다른 점수가 나온다.** 82였다가, 다음엔 76이었다가. 평가 시스템에서 이건 치명적이다 — 재현이 안 되면 신뢰가 안 된다.

"그럼 `temperature=0`을 주면 되지 않나?" 도움은 된다. 하지만 그게 *보장*은 아니다. temperature=0은 *덜 흔들리게* 할 뿐, 모델·인프라·프롬프트의 미세한 변화에 여전히 출력이 달라질 수 있다. **재현성을 모델의 선의에 맡기는 한, 그건 보장이 아니라 희망이다.**

그렇다고 전부 고정 점수로 박아버리면? 뉘앙스가 죽는다. 같은 등급 안에서도 "이 사람은 좀 더 위", "이건 좀 아래" 같은 판단을 못 한다. **일관성과 뉘앙스를 동시에** 얻는 게 문제의 본질이다.

## 패턴 — 결정론이 범위를 잠그고, LLM은 그 안에서만

`/fit`과 `/rating`이 택한 답은 **2-tier 하이브리드**다.

1. **결정론 tier — 등급과 점수 밴드를 잠근다.** 모델을 한 번도 부르지 않는다. 순수 코드가 입력에서 등급(S/A/B/C/D)을 계산하고, 등급마다 정해진 **점수 밴드 `[min, max]`**를 못박는다. 같은 입력이면 *항상* 같은 등급·같은 밴드. 테스트로 고정된다.
2. **에이전트 tier — 밴드 안에서만 판단한다.** 잠긴 밴드 `[min, max]`와 증거를 모델에게 주고, *밴드 안의* 정수 점수 + 근거를 받는다. 점수는 밴드로 **clamp**되고, 증거에 없는 ref를 인용한 근거는 게이트가 버린다.

즉 **모델은 등급을 바꿀 수 없다.** S를 받을 사람이 모델 한 번 흔들렸다고 A로 떨어지지 않는다. 모델이 만지는 건 *밴드 안의 미세한 디테일*뿐이다.

여기서 핵심 통찰이 나온다 — **재현성의 보장은 밴드다, temperature가 아니다.** temperature=0은 seam 너머로 best-effort로 전달되지만, "티어를 넘어 과장할 수 없다"를 보장하는 건 *결정론적으로 잠긴 밴드*다. 모델이 흔들려도 그 흔들림은 밴드 폭 안으로 갇힌다.

## 인스턴스 1 — `/fit`: JD 부합도

`/fit`은 내 grounded 증거가 특정 JD(채용공고)에 얼마나 맞는지를 평가한다.

```text
결정론 (fit/score.py):
  coverage% = (grounded claim 토큰 ∩ JD 키워드) 비율
  coverage% → 등급:   S≥90  A≥75  B≥55  C≥35  그 외 D
  등급 → 점수 밴드:   S 96–100 · A 85–95 · B 70–84 · C 55–69 · D 0–54
  (모델 호출 없음 — 같은 포트폴리오+JD면 항상 같은 등급/밴드)

에이전트 (fit/grade.py):
  잠긴 밴드 [min,max] + 증거 → 밴드 안의 점수 + 근거
  점수는 밴드로 clamp, un-grounded 근거는 drop
```

정직성을 위해 하나 — 이건 JD 키워드 **커버리지** rubric이지 "당신은 N% 적합"이라는 총체 판정이 아니다. 경력 연차·도메인 깊이를 모델링하지 않는다. *덜 약속한다.*

## 인스턴스 2 — `/rating`: 역량 등급

`/rating`은 같은 하이브리드인데, 등급의 **입력이 다르다.** JD가 아니라 *증거 메트릭 자체*다.

```text
결정론 (rating/profile.py) — 각 메트릭은 계산된 evidence ref를 인용:
  volume(머지 PR 수):      High 20+ →2pt · Steady 5–19 →1 · Low 0–4 →0
  breadth(distinct 파일):  Wide 30+ →2 · Moderate 10–29 →1 · Narrow 0–9 →0
  stack diversity(언어 수): Polyglot 4+ →2 · Versatile 2–3 →1 · Focused 0–1 →0
  points 합 → 등급:        6→S  4→A  2→B  1→C  0→D   (같은 점수 밴드)

에이전트 (rating/grade.py):
  temperature=0 grader, 밴드 clamp
  근거 bullet의 evidence_refs가 증거 집합에 없으면 drop
  malformed 응답(타입 오류/누락/깨진 JSON)은 밴드 midpoint로 폴백
```

`/fit`과 정확히 같은 골격 — 결정론이 등급을 잠그고, 에이전트는 밴드 안에서만. **패턴이 재사용된다**는 게 포인트다.

## 안 하는 것 — `/rating`은 "상위 X%"를 거부한다

`/rating`에서 가장 하고 싶은 말은 이게 **하지 않기로 한 것**이다.

`/rating`은 "당신은 전체 개발자 중 **상위 N%**입니다" 같은 모집단 비교를 하지 않는다. 그렇게 말하려면 *남들과 비교한 데이터*가 있어야 하는데, 그게 없다. **없는 걸 말하면 그게 곧 지어내기다.** 그래서 등급은 어디까지나 *내 증거 자체*에 대한 평가지 남과의 순위가 아니고, 렌더러는 percentile·population·ranking 어휘를 출력에서 막는다 — 그냥 막는 게 아니라 **테스트(`test_no_percentile_lexicon_in_rendered_output`)로 강제**한다.

이게 이 도구의 톤이다 — 멋지게 들리는 숫자를 위해 근거를 지어내느니, **덜 약속하고 정확히 지킨다.**

## 방어 디테일 두 개 — fail-closed

하이브리드의 두 번째 tier(모델)는 신뢰의 약한 고리다. 그래서 두 군데를 막아뒀다:

- **인용 없는 근거는 출하 금지.** 근거 bullet의 `evidence_refs`가 비었거나 증거 집합에 없으면 그 bullet을 버린다. (빈 집합이 부분집합 검사를 공허하게 통과하던 버그를 막은, 적대적 코드리뷰가 잡아준 케이스다.)
- **malformed 응답은 밴드 midpoint로.** 모델 응답이 wrong-type이거나 깨졌으면, 그 점수를 신뢰하지 않고 밴드 중앙값으로 폴백한다 — 크래시도, 날조된 ref도 없이.

두 경우 모두 "애매하면 모델을 신뢰하지 않는" 쪽으로 닫는다. fail-open이 아니라 fail-closed.

## 가져갈 것

- **LLM에게 점수를 직접 맡기지 마라 — 범위를 코드로 잠그고, 모델은 그 안에서만 판단하게 하라.** 일관성(밴드)과 뉘앙스(밴드 내 판단)를 동시에 얻는다.
- **재현성의 보장은 결정론이지 `temperature`가 아니다.** temperature=0은 best-effort일 뿐. "티어를 넘어 과장 못 함"을 보장하는 건 잠긴 밴드다.
- **모델 tier는 fail-closed로 감싸라.** 인용 없는 근거는 버리고, 깨진 응답은 안전한 기본값으로. 약한 고리를 구조로 막는다.
- **근거 없이 가능한 주장은 기능에서 빼라.** "상위 X%"처럼 지어내야만 나오는 숫자는, 안 하는 게 정직하다.

저장소: [github.com/AscendyProject/portfolio](https://github.com/AscendyProject/portfolio) (Apache-2.0, public).

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
