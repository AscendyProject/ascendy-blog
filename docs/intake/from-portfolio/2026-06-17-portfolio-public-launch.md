---
team: portfolio
date: 2026-06-17
topic: "portfolio 퍼블릭 런칭 — repo public 전환 + 5커맨드(/portfolio·/resume·/reference-check·/fit·/rating) 전부 출하. grounding gate 엔진 3레이어 위에 5개 산출물, grounding을 출력마다 재강제. Apache-2.0, 슬로건 'Every claim must be grounded.'"
suggestedCategory: "meta"
suggestedTags: ["grounding", "ai", "portfolio", "developer-tools", "launch", "trust"]
source: "portfolio 팀 글감 5부작 + 인트로(docs/requests/from-portfolio/ raw)의 정제본. 캐논은 public repo gh 검증."
redactionReviewed: true
---

> portfolio 팀 raw 글감(5부작 커맨드 + 인트로)의 정제본. **Class A/B 없음** — 전부 public OSS
> (`AscendyProject/portfolio`, Apache-2.0). 캐논은 공개 repo에서 gh로 직접 검증. 시크릿·키·사내
> 호스트·경로 없음. **출하/로드맵 검증 완료(2026-06-17):** repo PUBLIC, 5개 커맨드 PR 전부 MERGED
> (#6/#9/#10/#11/#12), OSS 위생 #13 MERGED, `fit/score.py`·`rating/profile.py`·`reference_check/letter.py`
> main에 실재. (이전 인트로 글감/글 #69에서 `/fit`·`/rating`이 "로드맵"이던 것은 이제 무효 — 출하됨.)

## 캐논 (gh 검증)

- repo: `github.com/AscendyProject/portfolio` — **PUBLIC**, Apache-2.0, v0.0.1.
- 커맨드 5개 전부 public main 출하: `/portfolio`(#6)·`/resume`(#9)·`/reference-check`(#10)·`/rating`(#11)·`/fit`(#12).
- OSS 위생 출하(#13): CI(ruff+pytest, Py 3.11/3.12)·`SECURITY.md`·`CONTRIBUTING.md`·pip-installable.
- 슬로건: **"Every claim must be grounded."**

## 엔진 — grounding gate 3레이어 (`/portfolio`)

```
1. extract  (결정론)  gh / web → 실제 머지 PR·변경 파일 → Evidence(불변 계약)
2. narrate  (LLM)     모델이 기여 claim 작성 — 주어진 Evidence 위에서, ref를 id로 인용
3. ground   (결정론)  모든 claim 검사: 인용 ref가 추출된 Evidence에 있나?
                      → grounded / rejected / needs-confirmation 3분할
```

- `extract`는 `gh`를 **argv 토큰으로만** 호출(셸 문자열 미조립 → 주입 표면 제거). 결과 `Evidence`는 모델이 손대지 못함.
- 모델은 가운데 `narrate` 한 곳에서만 호출. extract·ground는 결정론 코드 → 테스트·감사 가능.
- gate는 "이게 사실이냐"를 모델에 되묻지 않는다(또 환각) — *인용 ref가 증거에 존재하는가*라는 결정론 검사만. "deterministic checks before AI judgment."
- 근거 없는 주장을 **조용히 다듬어 통과시키지 않음** — 버리거나 사람 확인으로.

## 5커맨드 — grounding을 출력마다 재강제

- **`/portfolio`** — 엔진. grounded 포트폴리오(Markdown). 나머지 4개가 이 위에 섬.
- **`/resume`** — JD 맞춤 이력서. `enforce_grounding`이 *선별된 각 bullet의 ref를 다시* grounded 집합과 대조. 맞춤조차 게이트를 재통과. 모델은 새 사실을 만들지 않고 grounded claim 중 *고르기*만.
- **`/reference-check`** — grounded 추천서. **문단 단위** grounding — 근거 못 대는 문단은 통째로 드롭. "좋은 말이 아니라 근거 있는 말만."
- **`/fit`** — JD 부합 평가. **2-tier 하이브리드:** 결정론 등급(S/A/B/C/D, coverage% → 밴드 잠금, 모델 없음, 같은 입력=항상 같은 밴드) + 밴드 *안*에서만 에이전트 미세 점수(밴드로 클램핑). 모델은 등급을 못 바꾼다. (정직성: JD 키워드 *커버리지* rubric이지 "N% 적합" 총체 판정 아님.)
- **`/rating`** — 역량 평가. /fit과 같은 하이브리드지만 입력이 JD가 아니라 증거 메트릭(머지 PR 수·변경 파일 폭·스택 다양성, 각 메트릭이 정확한 evidence ref 인용). **출하 동작: "상위 X%" 모집단 비교/percentile을 하지 않음** — 비교할 모집단 데이터가 없어 말하면 곧 지어내기. 렌더러가 percentile 어휘를 테스트로 금지. 등급은 *자기 증거* rubric.
  - 방어 디테일(codex 적대적 리뷰가 잡음): 인용 없는 근거 불릿 출하 금지(빈 집합이 부분집합 검사를 공허 통과하던 버그 차단), malformed 응답은 밴드 midpoint 폴백.

## 하이브리드 결정론 패턴 (재사용 가능)

"**결정론이 범위를 잠그고 LLM은 그 안에서만 판단한다**" — LLM 일관성 문제의 일반해. 재현성 보장은
*밴드*이지 temperature가 아니다(temperature=0은 seam에서 best-effort).

## 외부에 공유하면 안 되는 부분 (redaction)

- 데모 캡처 쓰면 로컬 경로/실명 핸들/실제 JD·회사명 가릴 것(글감엔 없음).
- 과장 카피("최고의 AI 이력서") 금지 — 톤은 겸손한 정직성.
- `/rating`의 *미래 방향*(데이터 수집 등)은 미공개 전략이라 쓰지 않음 — **출하된 동작만**.
