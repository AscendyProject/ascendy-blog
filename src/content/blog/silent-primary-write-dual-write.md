---
title: "초록불이 거짓말을 하고 있었다 — succeeded 옆의 ERROR가 드러낸 두 겹의 함정"
description: "워커 로그에 매번 같은 ERROR가 찍히는데, 바로 다음 줄에서 태스크는 succeeded로 끝났다. 그 모순이 단서였다 — dual-write가 primary 쓰기 실패를 가리고, create-guard가 스키마 진화를 기존 컬렉션에 전파하지 않은 두 겹의 함정. 성공한 태스크의 핵심 작업이 매번 실패하고 있었다."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["vector-database", "schema-migration", "observability", "debugging", "idempotency", "silent-failure"]
category: "backend"
lang: "ko"
translationKey: "silent-primary-write-dual-write"
sourceIntake:
  - "docs/intake/from-backend/2026-05-31-silent-primary-write-failure-masked-by-dual-write.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 워커 로그에 매 작업마다 같은 ERROR가 찍히는데, **바로 다음 줄에서 그 태스크는 `succeeded`로 끝났다.** 이 모순이 전부의 시작이었다.
- 원인은 두 겹. ① **dual-write가 실패를 가렸다** — 쓰기 경로가 둘인데 태스크의 성공 판정이 *부수적인* 쪽에만 묶여 있어서, 정작 **주(primary) 쓰기가 매번 실패해도 초록불**이었다. ② **create-guard 함정** — `if not exists: create`는 컬렉션이 이미 있으면 새 스키마를 무시해서, 코드와 실데이터의 스키마가 조용히 갈라졌다.
- 쓰기뿐 아니라 **읽기(검색)까지** 같은 필드로 깨져 있었다. fix는 코드가 아니라 일회성 데이터 작업이었고, 마지막에 **운영(prod)에 같은 드리프트가 있는지 read-only로 따로 확인**했다(다행히 prod는 깨끗했다).

> **소스 노트.** 이 글은 백엔드 팀의 인테이크(`docs/intake/from-backend/2026-05-31-silent-primary-write-failure-masked-by-dual-write.md`)를 정제한 것이다. 컬렉션·필드·모듈 이름과 운영 규모 숫자는 일반화했다. 같은 "조용한 실패" 가족의 형제 글은 [ERROR는 보이는데 INFO만 사라졌다](/blog/celery-silent-info-logs/)이다 — 그쪽은 로그가 사라졌고, 이쪽은 **성공 판정이 거짓말을 했다.**

## succeeded 옆의 ERROR

다른 작업을 보던 중, 워커 로그에서 매 reindex마다 똑같은 ERROR가 반복되는 걸 봤다. 벡터DB에 어떤 필드를 넣으려는데 "컬렉션에 없는 필드이고 dynamic field도 꺼져 있다"며 거부당하는 에러였다. 그런데 이상했다.

**바로 다음 줄에서, 그 태스크는 `succeeded`로 끝나 있었다.**

작업은 성공이라는데 그 안에서 쓰기는 거부당하고 있다. 이 모순 하나가 단서였다. 성공 판정이 실제로 일어난 일을 반영하지 않고 있다는 뜻이니까.

## 함정 1 — dual-write가 실패를 가렸다

추적해보니 텍스트검색 벡터를 쓰는 경로가 **둘**이었다. 권위 있는 **주 컬렉션(primary)**, 그리고 점진적으로 도입 중이던 **멀티벡터 컬렉션(additive dual-write)**. 문제는 성공/실패가 판정되는 자리였다.

```python
def reindex(media_id):
    try:
        primary_upsert(media_id, ...)     # 매번 실패해도 ERROR 로깅만 하고 통과
    except Exception as e:
        logger.error("primary write failed: %s", e)
    secondary_dual_write(media_id, ...)   # 이게 성공하면 태스크는 succeeded
    # → 메트릭/상태는 초록불, primary는 비어 감
```

primary 쓰기는 함수 안의 `try/except`로 에러를 잡아 **로깅만 하고 넘어갔고**, 태스크의 성공/실패는 dual-write 경로의 결과로만 반영됐다. 그래서 primary가 매번 실패해도 태스크는 항상 succeeded. 로그를 grep하지 않으면 보이지 않는 silent failure였다.

여기에 설계의 아이러니가 있다. dual-write는 원래 "**실패해도 본체에 영향 없게**" 하려고 둔 안전장치다. 그런데 가려야 할 방향이 뒤집혀서 — 가려진 쪽이 정작 **primary**가 되자 — 같은 장치가 실패를 *은폐하는* 장치로 변했다.

## 함정 2 — create-guard는 스키마 진화에 침묵한다

primary 쓰기가 왜 거부됐나. 컬렉션 생성 코드가 이 형태였다.

```python
def get_collection(name: str):
    if not has_collection(name):          # ← 여기 분기
        schema = build_current_schema()   #   기존 컬렉션엔 절대 실행되지 않음
        create(name, schema)
        create_index(name)
    return load(name)
```

`if not has_collection`은 멱등해 보인다. 그런데 함정이 있다 — **컬렉션이 이미 있으면 스키마 정의는 통째로 무시된다.** 몇 달 전 코드 스키마에 새 필드가 추가됐지만, 그보다 먼저 생성돼 있던 dev 컬렉션은 구 스키마를 그대로 유지했다. 벡터DB(그리고 schema-on-write 저장소 일반)는 RDB의 `ALTER` 같은 암묵적 전파가 없다. 그래서 **코드 스키마와 실데이터 스키마가 조용히 갈라진 채 굳었다.**

추측이 아니라 실측으로 못 박았다. 라이브 컬렉션 스키마를 직접 조회했다.

```text
# 기대: [id_field, tenant_filter_field, text_field, vector_field]
# 실제: [id_field, text_field, vector_field]   ← tenant_filter_field 누락 = 드리프트 확정
```

코드가 넣으려는 필드가 실데이터엔 없었다. 게다가 검색 경로도 그 필드로 필터링하고 있었으니, **쓰기뿐 아니라 읽기까지** 이 컬렉션에서는 깨져 있었다.

## fix는 코드가 아니라 데이터였다

코드 스키마는 처음부터 옳았다. 틀린 건 먼저 만들어져 굳어버린 실데이터였다. 그래서 fix는 코드 변경이 아니라 **일회성 데이터 작업**이었다 — 드리프트된 dev 컬렉션을 drop하고, 서비스의 생성 경로(동일 스키마 + 인덱스 + load)로 재생성했다. 마침 돌고 있던 bulk reindex가 새 컬렉션을 다시 채웠고, 재생성 직후부터 primary 쓰기가 성공 로그를 찍기 시작했다(ERROR 소멸).

그리고 한 단계가 더 남아 있었다. **운영(prod)에도 같은 드리프트가 있나?** 있다면 prod의 검색까지 깨져 있다는 뜻이다. 그래서 prod 컬렉션 스키마를 **read-only로 1회만** 조회해 필드 세트를 비교했다. prod는 그 필드를 이미 갖고 있었고 정상 규모로 적재돼 있었다 — 드리프트는 dev 한정이었고, prod는 손대지 않았다. "dev에서 고쳤으니 prod도 같겠지"라고 가정하지 않은 그 확인 자체가 작업의 일부였다.

## 가져갈 것

- **`if not exists: create`는 스키마가 고정일 때만 멱등하다.** 스키마가 진화하면 기존 객체엔 영영 반영되지 않는다. 드리프트 감지 가드나 명시적 마이그레이션 단계를 두라. schema-on-write 저장소엔 암묵적 `ALTER`가 없다.
- **dual-write를 도입할 땐 태스크 성공 판정이 어느 쪽 쓰기에 묶였는지 명시하라.** "실패해도 본체 영향 없음"이라는 안전장치는, 가려지는 방향이 뒤집히면 실패-은폐 장치가 된다.
- **"succeeded 로그 바로 옆의 ERROR"는 1차 신호다** — 성공 판정이 실제 핵심 작업을 반영하지 않는다는. 추측 말고 실데이터를 직접 조회해 확정하라.
- **dev에서 고쳤으면, 같은 드리프트가 prod에 있는지 read-only로 따로 확인하라.** 고친 것과 안전을 확인한 것은 다른 일이다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
