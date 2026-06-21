---
team: backend
date: 2026-06-20
topic: "테스트는 초록인데 validator는 프로덕션에서 아무 일도 안 했다(호출은 됨, 정규화 분기만 no-op) — Pydantic v2 mode='before' vs 'after'는 실행 순서이고 그 순서가 받는 값의 '타입'을 결정한다. 그리고 직렬화 경계를 넘는 로직은 테스트도 그 경계를 넘겨야 한다(false-green)."
suggestedCategory: "backend"
suggestedTags: ["pydantic", "validation", "testing", "false-green", "code-review", "timezone"]
source: "backend 팀 인테이크(2026-06-20 pydantic validator false-green)의 정제본. 내부 식별자 일반화. Pydantic before/after 동작은 공식 문서로 확인 가능한 public 사실."
redactionReviewed: true
---

> backend 팀 raw 인테이크의 정제본. **일반화:** 내부 API 경로·모듈/클래스·필드명·PR 번호는
> 일반 이름으로 치환(`UploadFinalizeRequest`, `capture_time`). **범위 한정:** 이 글은 *Pydantic
> validator-mode + 테스트 충실도*만 다룬다 — 같은 PR의 다른 변경은 성격이 달라 본문 범위 밖이며
> 언급하지 않는다. 시크릿·사내 호스트·고객 식별 데이터 없음.

## 한 일 (일반화)

타임존-naive `DateTime` 컬럼에, 클라이언트가 `Z`/`+09:00` offset을 붙여 보내는 타임스탬프 필드
하나를 저장하는 작업. offset을 naive UTC로 정규화하려고 Pydantic `field_validator`를 붙였다.
단위 테스트 6개를 썼고 전부 초록. 그런데 **적대적 코드 리뷰가 "이 validator는 프로덕션에서
아무 일도 안 한다(호출은 되지만 정규화 분기가 실행 안 됨)"를 적발**했다.

## 2겹 원인

1. **`mode="before"`의 의미** — before validator는 Pydantic이 타입을 *강제하기 전*에 돈다. HTTP
   JSON으로 온 값은 이 시점에 아직 **문자열**(`"2024-05-02T03:00:00+09:00"`). `isinstance(v, datetime)`
   분기는 항상 False → 정규화를 그냥 지나치고, 이후 Pydantic이 tz-aware datetime으로 파싱한 값이
   tz가 안 벗겨진 채 저장된다.
2. **테스트가 입력 '모양'을 안 맞춤** — 테스트는 생성자에 *이미 datetime 객체*를 넣어
   (`UploadFinalizeRequest(capture_time=<datetime>)`) `isinstance`가 참이 되는 경로를 탔다.
   프로덕션(JSON 역직렬화)과 다른 입력 타입이라 validator가 도는 것처럼 보였다. 초록불이 거짓.

## fix (2줄)

- validator를 **`mode="after"`**로 — 문자열→datetime 파싱이 끝난 뒤 돌아 `v`가 항상 datetime(또는 None)이라 정규화가 실제 적용.
- 테스트를 **`model_validate_json(...)`**로 — 진짜 JSON 문자열(`"...Z"`, `"...+09:00"`, `null`)을 먹여 직렬화 경계(문자열→객체 변환)를 재현해 검증.

## 교훈 (이게 글의 값)

- **before vs after는 실행 순서(내부 검증 전/후)이고, 그 순서가 *받는 값의 타입*을 결정한다.** before=raw(대개 문자열/딕셔너리), after=파싱·강제가 끝난 타입. *이미 파싱된 typed 값* 정규화(datetime tz strip 등)는 after가 맞고, raw 문자열 trim·전처리는 before가 적합할 수 있다(사건 범위로 한정). before에서 `isinstance`로 typed 값을 가정하면 조용히 no-op이 된다.
- **직렬화 경계를 넘는 로직(검증·정규화·파싱)은 테스트도 그 경계를 넘겨야 한다.** 객체를 생성자로 직접 만들면 "검증하려던 그 변환"을 우회한 채 초록불만 받는다 — false-green. `model_validate_json()`으로 JSON 문자열 입력(직렬화 경계)을 재현해 쳐라.
- "테스트는 초록인데 동작 안 함"의 1차 진단: **테스트가 프로덕션과 동일한 입력 타입/진입 경로를 타는지부터 의심**하라. 결정적 단서는 리뷰어가 테스트와 다르게 *JSON 문자열로* 모델을 만들어 본 것이었다.

## 코드 (일반화된 스니펫)

```python
# 안티패턴 — before validator에서 isinstance로 타입 가정. JSON 입력은 아직 str이라 분기가 늘 빗나감(no-op).
@field_validator("capture_time", mode="before")
@classmethod
def _strip_tz_wrong(cls, v):
    if isinstance(v, datetime) and v.tzinfo is not None:   # str일 땐 False
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v

# 수정 — after validator. 파싱이 끝나 v가 항상 datetime(또는 None).
@field_validator("capture_time", mode="after")
@classmethod
def _strip_tz(cls, v: datetime | None) -> datetime | None:
    if v is not None and v.tzinfo is not None:
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v
```

```python
# false-green 테스트 — 생성자에 datetime 객체 직접 주입(변환 경로 우회).
req = UploadFinalizeRequest(capture_time=datetime(2024, 5, 2, 3, tzinfo=KST))

# 수정 테스트 — 프로덕션과 같은 입력 모양(JSON 문자열).
req = UploadFinalizeRequest.model_validate_json('{"capture_time": "2024-05-02T03:00:00+09:00"}')
assert req.capture_time == datetime(2024, 5, 1, 18, 0, 0)   # naive UTC
assert req.capture_time.tzinfo is None
```

## 참고

- Pydantic v2 validators 공식 문서(mode before/after) — 공개 자료, 본문 사실 근거.
