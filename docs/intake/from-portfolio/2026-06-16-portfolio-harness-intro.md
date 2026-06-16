---
team: portfolio
date: 2026-06-16
topic: "portfolio 하네스 소개(런칭) — '지어내지 않는' grounded 포트폴리오. 증거(gh로 결정론 추출)를 먼저 고정하고, 모델은 그 위에서만 서술하며, grounding gate가 un-grounded claim을 거부. 신뢰를 바람이 아니라 구조로 보장. 출하=/portfolio·/resume·/reference-check, 로드맵=/fit·/rating. Apache-2.0, v0.0.1 early scaffold."
suggestedCategory: "meta"
suggestedTags: ["grounding", "ai", "portfolio", "developer-tools", "harness", "trust"]
redactionReviewed: true
---

> portfolio 팀 raw 글감의 정제본. **Class A/B 없음** — 전부 public OSS(`AscendyProject/portfolio`,
> Apache-2.0)라 README·아키텍처·커맨드·코드는 공개 OK. 시크릿·키·사내 경로·호스트명 없음.
> 정직성 가드(아직 없는 기능을 "있다"고 쓰지 않기)는 본문에서 출하/로드맵을 명확히 분리해 준수.

## 한 줄 피치

> 개발자의 실제 GitHub 작업을 **grounded 포트폴리오**로 — 모든 주장은 증거로 추적되고, 절대 지어내지 않는다.
> ("Turn a developer's real GitHub work into a grounded portfolio — every claim traced to evidence, never invented.")

## 무엇이고 무슨 문제를 푸나

AI 포트폴리오/이력서 생성기는 만들기는 쉽고 **믿기는 어렵다** — 과장하고, 환각하고, 키워드를 쑤셔넣는다.
portfolio 하네스는 이걸 뒤집는다:

- **증거가 결정론적이다.** 실제 머지된 PR·변경 파일을 `gh`로 끌어와 Evidence로 만든다(모델이 이 집합에 손대지 못한다).
- **모델은 "있는 증거 위에서만" 쓴다.** 기여 claim을 작성하되 반드시 실재하는 ref(PR/커밋/파일 id)를 인용해야 한다.
- **grounding gate가 거른다.** 아무것도 인용 안 했거나 추출된 적 없는 ref를 인용한 claim은 거부 — 절대 출하되지 않는다.

핵심 슬로건: **"Every claim must be grounded."**

## 3 레이어 (캐논)

```
1. extract   (결정론)   gh → 실제 머지 PR·변경 파일 → Evidence
2. narrate   (LLM)      모델이 기여 claim을 작성 — 주어진 증거 위에서, ref를 id로 인용
3. ground    (결정론)   모든 claim 검사: 인용한 ref가 추출된 Evidence 집합에 있나?
                        un-grounded → 버리거나 사람 확인으로, 절대 출하 안 함
```

extract·ground 레이어는 **모델을 절대 호출하지 않고**, narrate 레이어만 호출한다. 이 분리가 아키텍처의 전부다(테스트·감사 가능).

## 핵심 차별점 (⭐ = 가장 덜 자명)

1. ⭐ **신뢰 모델을 통째로 뒤집는다.** 보통 AI 작성기는 "모델이 생성 → 사실이길 기대". 여기선 **증거가 먼저 결정론적으로 고정**되고 모델은 그 위에서만 서술한다 — "지어내지 않음"이 바람이 아니라 **구조적 보장**.
2. **grounding gate**가 claim을 grounded / rejected / **needs-confirmation** 세 갈래로 나눈다. 인용이 가짜면 사람 확인으로 보내거나 버린다 — 조용히 "고쳐서" 통과시키지 않는다.
3. ⭐ **"deterministic checks before AI judgment".** 모델은 *이야기*를 쓰고, *코드*가 *인용*을 검증한다. 모델에게 "이게 사실이냐"를 묻지 않는다(결정론 검사).
4. ⭐ **출력 단계마다 grounding을 재강제.** 예: `/resume`는 JD에 맞춰 bullet을 고를 때 각 bullet의 ref를 grounded 집합과 **다시** 대조한다(`enforce_grounding`). 환각 ref는 맞춤 이력서에도 못 낀다 — 한 번 grounding하고 끝이 아니다.
5. **stdlib-only 결정론 코어.** 외부 런타임 의존성 없이 동작, 모델 호출은 narrate 레이어로 격리.

## 현재 성숙도 (정직하게)

- **early / v0.0.1** — README가 스스로 "early scaffold"라 명시.
- **출하(main):** 결정론 grounding 코어(Evidence/Claim 계약, gh→Evidence 추출, gate) + **`/portfolio`**(grounded 포트폴리오를 Markdown으로) + **`/resume`**(JD 맞춤 grounded 이력서, 환각 ref는 `enforce_grounding`이 거부) + **`/reference-check`**(grounded 추천서 — 모든 문단이 실재 증거 ref 인용; PR #10로 2026-06-16 머지).
- **로드맵(아직 "있다"고 쓰지 말 것):** `/fit`(JD 결정론 매칭 %), `/rating`(증거 기반 역량 — 단 근거 없는 "상위 X%" 절대주장은 의도적으로 **안 함**).

## 설치 / CTA

```bash
python -m portfolio --source-type github --source <repo-url> --author <handle>
# → grounded 포트폴리오(Markdown). 슬래시 커맨드 /portfolio 는 인터랙티브 진입점.
# JD 맞춤 이력서:
python -m resume --source-type github --source <url> --author <handle> --jd <jd.txt>
```

- repo: `github.com/AscendyProject/portfolio` (Apache-2.0, v0.0.1)

## 권장 앵글

- "AI가 써주는 포트폴리오는 왜 못 믿나 → 신뢰를 *구조*로 푼 방식"이라는 meta 앵글이 가장 강함. 기능 나열보다 **grounding gate라는 한 가지 아이디어**를 끝까지 미는 글.
- early 단계라 기능 투어보다 **철학 + CTA**가 적합(짧은 런칭 글 한 편).

## 외부에 공유해도 좋은 부분
- 위 캐논 전부 — public repo(Apache-2.0)라 README·아키텍처·커맨드·코드 공개 OK.
- 3-레이어, grounding gate 개념, `gh` 기반 결정론 추출 패턴.

## 외부에 공유하면 안 되는 부분
- 아직 없는 기능을 "있다"고 쓰지 말 것(`/fit`·`/rating`=계획). (`/reference-check`은 2026-06-16 PR #10로 머지돼 출하로 분류 — 글감 작성 시점엔 draft였으나 같은 날 머지됨.)
- 과장 카피 금지("최고의/완벽한 AI 이력서") — 이 제품의 포인트는 *겸손한 정직성*이라 톤이 어긋남.
- (시크릿·사내 경로·호스트명 — 이 글감엔 없음. 데모 캡처 쓰면 로컬 경로/핸들 가림.)
