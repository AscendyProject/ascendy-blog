---
title: "테스트는 다 초록인데, validator는 한 번도 안 돌았다"
description: "타임존을 벗기는 Pydantic validator를 붙이고 테스트 6개가 다 통과했다. 그런데 프로덕션에선 한 번도 실행되지 않았다. mode='before'는 타입 강제 '전'에 돌아 입력이 아직 문자열이라 isinstance 분기가 늘 빗나갔고, 테스트는 datetime 객체를 직접 넣어 그 버그를 가렸다. false-green의 해부."
pubDate: 2026-06-20
author: "Ascendy Engineering"
tags: ["pydantic", "validation", "testing", "false-green", "backend"]
category: "backend"
lang: "ko"
translationKey: "pydantic-before-after-false-green"
sourceIntake:
  - "docs/intake/from-backend/2026-06-20-pydantic-before-after-false-green.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 타임존을 벗기는 Pydantic validator를 붙이고 **단위 테스트 6개가 전부 초록**이었다. 그런데 그 validator는 **프로덕션에서 한 번도 실행되지 않았다.**
- 원인은 두 겹이었다: ① Pydantic v2의 `mode="before"`는 타입을 강제하기 *전*에 돌아서, HTTP JSON으로 온 값이 이 시점엔 아직 **문자열**이다 → `isinstance(v, datetime)` 분기가 항상 빗나가 no-op. ② **테스트가 `datetime` 객체를 생성자에 직접 넣어** 버그를 가렸다.
- fix는 두 줄 — validator를 `mode="after"`로, 테스트를 `model_validate_json()`으로.
- 교훈 둘: **`before`/`after`는 순서가 아니라 *받는 값의 타입*이 다르다**, 그리고 **직렬화 경계를 넘는 로직은 테스트도 그 경계를 넘겨야 한다**(안 그러면 false-green).

> **소스 노트.** backend 팀 인테이크를 정제한 글이다. 내부 식별자는 일반 이름으로 바꿨고(`UploadFinalizeRequest`, `capture_time`), Pydantic의 before/after 동작은 [공식 문서](https://docs.pydantic.dev/latest/concepts/validators/)로 확인 가능한 사실이다. 같은 *적대적 리뷰가 잡았다* 결의 [한 AI가 쓴 PR을 다른 AI가 리뷰해 HIGH 결함 4개를 잡은 글](/blog/redteam-adversarial-review-four-bugs/)과 이어진다.

## 작은 작업이었다

타임존-naive `DateTime` 컬럼에, 클라이언트가 보낸 타임스탬프 하나를 저장하는 일이었다. 클라이언트는 `Z`나 `+09:00` 같은 offset을 붙여 보내는데, DB도 다른 추출 경로도 전부 naive 값을 쓰니 그 offset을 **naive UTC로 정규화**해야 했다. 그래서 Pydantic 필드에 validator를 하나 붙였다:

```python
@field_validator("capture_time", mode="before")
@classmethod
def _strip_tz(cls, v):
    if isinstance(v, datetime) and v.tzinfo is not None:
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v
```

단위 테스트를 6개 썼다. UTC `Z`, 비-UTC offset, `null`… 다 "검증"했고 전부 통과했다. 머지해도 될 것 같았다.

그런데 적대적 코드 리뷰에서 한 줄이 날아왔다 — **"이 validator, 프로덕션에선 한 번도 안 도는데요?"**

## 1겹 — `mode="before"`는 내가 생각한 그게 아니었다

`before`와 `after`. 이름만 보면 "검증 전이냐 후냐" 하는 *순서* 문제처럼 읽힌다. 아니었다. 진짜 차이는 **validator가 받는 값의 타입**이다.

`mode="before"` validator는 Pydantic이 타입을 **강제(coerce)하기 전**에 돈다. 그래서 HTTP JSON 바디로 들어온 `capture_time`은 이 시점에 아직 **문자열**이다 — `"2024-05-02T03:00:00+09:00"`. 그런데 내 코드는 `isinstance(v, datetime)`을 물었다. 문자열에 대해선 **항상 False.** 정규화 분기는 그냥 건너뛰어지고, 그 뒤 Pydantic이 문자열을 tz-aware `datetime`으로 파싱해서 — **tz가 안 벗겨진 채로** 저장된다.

validator는 거기 있었지만, 아무 일도 하지 않았다. 조용한 no-op.

## 2겹 — 테스트가 프로덕션과 다른 입력을 먹였다

그럼 테스트는 왜 초록이었나? 테스트가 모델을 이렇게 만들었기 때문이다:

```python
# 변환 경로를 우회한다 — 이미 datetime 객체를 직접 넣음
req = UploadFinalizeRequest(capture_time=datetime(2024, 5, 2, 3, tzinfo=KST))
```

생성자에 **이미 `datetime` 객체**를 넣으면, before validator가 받는 `v`는 문자열이 아니라 `datetime`이다. 그러면 `isinstance(v, datetime)`이 참이 되고 — validator가 *정상 동작하는 것처럼* 보인다.

테스트는 프로덕션과 **다른 입력 타입**을 먹였다. 프로덕션은 JSON 문자열을 역직렬화하고, 테스트는 객체를 직접 조립했다. 같은 모델, 다른 진입 경로. 그래서 테스트는 *내가 검증하려던 바로 그 변환*(문자열 → 파싱 → tz strip)을 통째로 건너뛴 채 초록불을 켰다. **거짓 초록.**

## fix — 두 줄

```python
# validator: after로. 파싱이 끝난 뒤 돌아 v가 항상 datetime(또는 None).
@field_validator("capture_time", mode="after")
@classmethod
def _strip_tz(cls, v: datetime | None) -> datetime | None:
    if v is not None and v.tzinfo is not None:
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v
```

```python
# 테스트: 프로덕션과 같은 입력 모양(JSON 문자열)으로.
req = UploadFinalizeRequest.model_validate_json('{"capture_time": "2024-05-02T03:00:00+09:00"}')
assert req.capture_time == datetime(2024, 5, 1, 18, 0, 0)   # naive UTC
assert req.capture_time.tzinfo is None
```

`mode="after"`에서는 Pydantic이 이미 문자열을 `datetime`으로 파싱한 뒤라, `v`가 항상 `datetime`(또는 `None`)이다. tz strip이 *실제로* 적용된다. 그리고 테스트를 `model_validate_json()`으로 바꾸니 프로덕션이 받는 입력 모양 그대로 — 진짜 JSON 문자열을 먹게 됐다.

## 가져갈 것

이 버그의 진단 시간은 대부분 *코드 고치기*가 아니라 **"왜 테스트는 도는데 실제론 안 되지?"**를 가르는 데 들었다. 두 가지가 남는다.

- **`before` vs `after`는 순서가 아니라 *타입*이다.** before는 raw 입력(대개 문자열·딕셔너리), after는 파싱·강제가 끝난 타입을 받는다. 타입 정규화(tz strip, trim, 범위 클램프)를 하려면 거의 항상 **after**가 맞다. before에서 `isinstance`로 타입을 가정하면 raw 입력에서 빗나가 조용히 no-op이 된다.
- **직렬화 경계를 넘는 로직은, 테스트도 그 경계를 넘겨야 한다.** 검증·정규화·파싱처럼 "문자열 → 객체" 변환이 끼는 로직은, 객체를 생성자로 직접 만들어 넣으면 *그 변환을 우회*한 채 초록불만 받는다. `model_validate_json()`처럼 **프로덕션과 같은 진입 경로**로 쳐라. 이건 Pydantic을 넘어 언어·프레임워크 불문하고 적용되는 교훈이다 — ORM 역직렬화, API 디시리얼라이저, 메시지 큐 파서 전부.
- **"테스트 초록인데 동작 안 함"의 1차 의심은 입력 모양이다.** 코드가 틀린 게 아니라, 테스트가 프로덕션과 다른 진입 경로를 타서 버그를 가린 것일 수 있다. 결정적 단서는 리뷰어가 *테스트와 똑같이*가 아니라 JSON 문자열로 직접 모델을 만들어 본 것이었다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
