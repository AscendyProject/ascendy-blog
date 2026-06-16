---
title: "AI가 써주는 포트폴리오를 못 믿는 이유 — '지어내지 않음'을 바람이 아니라 구조로 만들었다"
description: "AI 포트폴리오·이력서 생성기는 만들긴 쉽고 믿긴 어렵다 — 과장하고 환각한다. portfolio 하네스는 신뢰 모델을 뒤집는다: 증거(gh로 결정론 추출)를 먼저 고정하고, 모델은 그 위에서만 서술하며, grounding gate가 근거 없는 주장을 거부한다. '지어내지 않음'을 바람이 아니라 구조로."
pubDate: 2026-06-16
author: "Ascendy Engineering"
tags: ["grounding", "ai", "portfolio", "developer-tools", "harness", "trust"]
category: "meta"
lang: "ko"
translationKey: "portfolio-harness-launch"
sourceIntake:
  - "docs/intake/from-portfolio/2026-06-16-portfolio-harness-intro.md"
draft: false
redactionReviewed: true
---

## TL;DR

- **portfolio**를 오픈소스로 공개한다(v0.0.1, Apache-2.0). 개발자의 실제 GitHub 작업을 **grounded 포트폴리오**로 만드는 하네스다 — *모든 주장은 증거로 추적되고, 절대 지어내지 않는다.*
- AI 포트폴리오/이력서 생성기의 진짜 문제는 품질이 아니라 **신뢰**다. 과장하고, 환각하고, 키워드를 쑤셔넣는다. portfolio는 그 **신뢰 모델을 통째로 뒤집는다.**
- 보통은 "모델이 생성 → 사실이길 기대"다. 여기선 **증거가 먼저 결정론적으로 고정**되고(`gh`로 실제 머지된 PR·변경 파일을 추출), 모델은 그 위에서만 서술한다. **`check_claims`라는 grounding gate**가 근거 없는 주장을 grounded / rejected / needs-confirmation으로 가른다 — 조용히 "고쳐서" 통과시키지 않는다.
- 핵심 슬로건 한 줄: **"Every claim must be grounded."**

> **소스 노트.** portfolio 팀 인테이크를 정제한 글이다. 전부 public OSS(`AscendyProject/portfolio`, Apache-2.0)라 캐논 사실은 repo README에서 직접 가져왔다. 같은 *신뢰를-구조로* 결의 [적대적 에이전트-페어 하네스 redteam](/blog/redteam-launch/), 그리고 [AI가 쓴 글의 할루시네이션을 어디까지 허용할 것인가](/blog/benevolent-lie-hallucination/)와 이어진다.

## AI 포트폴리오의 진짜 문제는 거짓말이다

AI로 포트폴리오나 이력서를 만드는 건 쉽다. 프롬프트 한 줄이면 그럴듯한 bullet이 쏟아진다. 그런데 그걸 **믿을 수 있나?**

문제는 품질이 아니라 **신뢰**다. 생성형 모델은 자신 있게 과장하고, 존재하지 않는 성과를 환각하고, 채용 키워드를 매끄럽게 쑤셔넣는다. 읽는 사람(채용 담당자)도 그걸 안다. 그래서 "AI가 써준 포트폴리오"라는 라벨 자체가 신뢰를 깎는다. *멋지게 쓰는* 건 이미 공짜인데, *믿을 수 있게 쓰는* 건 아무도 못 풀었다.

portfolio 하네스는 그 한 가지 문제 — **지어내지 않음** — 만 끝까지 판다.

## 보통의 신뢰 모델은 거꾸로다

대부분의 AI 작성기는 이렇게 동작한다:

> **모델이 글을 생성한다 → 그게 사실이기를 기대한다.**

사실 검증은 사후적이고, 대개 사람의 몫이다. 모델이 "Kubernetes 클러스터를 50% 비용 절감했다"고 쓰면, 그게 진짜인지는 *읽는 사람이 따로 확인*해야 한다. 확인 안 하면 환각이 그대로 출하된다. "지어내지 마"라고 프롬프트에 적는 건 *부탁*이지 *보장*이 아니다.

portfolio는 화살표를 뒤집는다:

> **증거를 먼저 결정론적으로 고정한다 → 모델은 그 증거 위에서만 서술한다 → 코드가 모든 주장의 인용을 검증한다.**

"지어내지 않음"이 **바람(prompt)이 아니라 구조(architecture)**가 되는 지점이다.

## 3 레이어 — 모델은 한 곳에서만 부른다

```text
1. extract   (결정론)   gh → 실제 머지된 PR·변경 파일 → Evidence 집합
2. narrate   (LLM)      모델이 기여 claim을 작성 — 주어진 증거 위에서, ref를 id로 인용
3. ground    (결정론)   모든 claim 검사: 인용한 ref가 추출된 Evidence 집합에 있나?
                        없으면 → 버리거나 사람 확인으로. 절대 출하 안 함.
```

핵심은 **extract와 ground 레이어가 모델을 절대 호출하지 않는다**는 것이다. 증거를 모으는 일도, 주장을 검증하는 일도 전부 결정론 코드다. 모델이 끼는 곳은 가운데 narrate 레이어 — *이야기를 쓰는* 단 한 곳뿐이다. 이 분리가 아키텍처의 전부다. 그래서 테스트할 수 있고, 감사할 수 있다.

비유하면 이렇다 — **모델은 변호사고, 증거 봉투는 따로 봉인돼 있다.** 변호사는 봉투 안의 증거만 인용해 변론할 수 있고, 봉투에 없는 걸 인용하면 판사(grounding gate)가 그 진술을 기각한다. 변호사가 증거를 *만들어 넣을* 방법은 없다.

## grounding gate — "조용히 고쳐서 통과"가 없다

검증 레이어의 핵심은 `check_claims(claims, evidence)`다. 모든 주장을 세 갈래로 가른다:

- **grounded** — 인용한 ref가 추출된 Evidence 집합에 실재함. 통과.
- **rejected** — 아무것도 인용 안 했거나, 추출된 적 없는 ref를 인용함. **버린다.**
- **needs-confirmation** — 애매한 경계. **사람 확인으로 보낸다.**

여기서 중요한 디테일 하나 — gate는 모델에게 **"이게 사실이냐"를 되묻지 않는다.** 그건 또 환각을 부른다. 대신 *인용한 ref가 증거 집합에 존재하는가*라는 **결정론적 검사**만 한다. "deterministic checks before AI judgment" — 모델은 이야기를 쓰고, 코드가 인용을 대조한다. 판단을 모델에게 다시 맡기지 않는 게 포인트다.

그리고 gate는 근거 없는 주장을 **조용히 다듬어서 통과시키지 않는다.** 버리거나, 사람에게 묻는다. "그럴듯하게 고쳐 끼우기"가 환각의 출하 경로인데, 그 경로를 구조적으로 막은 것이다.

## 한 번 grounding하고 끝이 아니다

흥미로운 건 grounding이 **출력 단계마다 다시 강제**된다는 점이다.

예를 들어 `/resume`는 채용공고(JD)에 맞춰 어떤 bullet을 넣을지 고른다. 이때 고른 각 bullet의 ref를 grounded 집합과 **다시** 대조한다(`enforce_grounding`). 즉 "포트폴리오를 grounding했으니 거기서 뽑은 이력서도 안전하겠지"가 아니라, **맞춤 이력서를 만드는 그 순간에도** 환각 ref가 끼어들 여지를 한 번 더 닫는다. grounding이 파이프라인의 입구 한 번이 아니라 *모든 출구*에 걸려 있는 셈이다.

## 정직하게 — 지금 어디까지 왔나

과장하지 않는 게 이 도구의 정체성이니, 성숙도도 정직하게 적는다.

- **early scaffold, v0.0.1.** README가 스스로 그렇게 부른다.
- **지금 실제로 출하된 것:** 결정론 grounding 코어(증거 추출 + gate) + **`/portfolio`**(grounded 포트폴리오를 Markdown으로) + **`/resume`**(JD 맞춤 grounded 이력서).
- **아직 아닌 것(로드맵):** `/reference-check`(grounded 추천서)는 **draft PR이고 미머지**다. `/fit`(JD 결정론 매칭 커버리지 %)와 `/rating`(증거 기반 역량 프로필)은 **아직 코드가 없다**. 특히 `/rating`은 근거 없는 "상위 X%" 같은 절대주장은 의도적으로 **하지 않을** 방향이다.

도구의 철학("지어내지 않음")을 도구 *소개글*에서부터 지키는 게 맞다고 봤다.

## 써보기

```bash
# 실제 GitHub 작업으로 grounded 포트폴리오를:
python -m portfolio --source-type github --source <repo-url> --author <handle>

# JD에 맞춘 grounded 이력서를:
python -m resume --source-type github --source <url> --author <handle> --jd <jd.txt>
```

슬래시 커맨드 `/portfolio`가 인터랙티브 진입점이다. 저장소: [github.com/AscendyProject/portfolio](https://github.com/AscendyProject/portfolio) (Apache-2.0).

## 가져갈 것

- **AI 작성 도구의 병목은 품질이 아니라 신뢰다.** 멋지게 쓰는 건 공짜가 됐고, 믿을 수 있게 쓰는 게 남은 문제다.
- **"지어내지 마"는 프롬프트가 아니라 구조여야 보장된다.** 증거를 먼저 고정하고, 모델은 그 위에서만 서술하고, 코드가 인용을 검증한다 — 모델의 선의에 기대지 않는다.
- **검증을 모델에게 되묻지 마라.** "이게 사실이냐"는 또 환각을 부른다. *인용한 ref가 증거에 존재하는가*라는 결정론적 검사로 바꾸면, 신뢰가 감사 가능한 속성이 된다.
- **grounding은 입구 한 번이 아니라 모든 출구에.** 한 번 통과시킨 데이터도 새 출력(맞춤 이력서 등)을 만들 때 다시 대조해야 환각이 끝까지 못 샌다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
