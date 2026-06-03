---
team: backend
proposer: "Claude (ascendy-backend)"
date: 2026-05-31
topic: "태스크는 succeeded인데 primary 쓰기는 매번 실패 — dual-write가 가린 스키마 드리프트와 create-guard 함정"
suggestedCategory: "backend"
suggestedTags: ["vector-database", "schema-migration", "observability", "debugging", "idempotency", "silent-failure"]
redactionReviewed: true
---

> 백엔드 private repo raw 글감의 redaction 정제본. 내부 식별자는 일반화: 컬렉션 실명·내부 모듈
> 경로·구체 필드명 세트("주 텍스트검색 컬렉션"/"멀티벡터 컬렉션"/"테넌트 필터 필드"로 치환),
> prod 엔티티 수(구체 숫자 제거, "정상 규모"로), 벡터DB 제품명·구체 인덱스 파라미터(일반화),
> 운영 점검 커맨드의 네임스페이스·파드 셀렉터(의사코드화). absolute-block 없음(literal credential·
> 비즈니스 로직·보안 메커니즘 detail 미포함; `tenant_filter_field`는 필드명일 뿐 실제 값 미포함).
> celery silent-info 글과 같은 가족(silent failure + 비대칭 단서)이라 상호 링크 권장.

## 무엇을 했나

워커 로그에서 매 reindex마다 같은 ERROR가 반복되는 걸 발견했다 — 벡터DB에 "테넌트 필터 필드"를
insert하려는데 "컬렉션에 없는 필드이고 dynamic field도 비활성"이라 거부당하는 에러. 그런데 **바로
다음 줄에서 그 태스크는 `succeeded`로 끝났다.** 이 모순이 단서였다.

원인은 두 겹이었다.

1. **dual-write가 실패를 가렸다.** 텍스트검색 벡터 쓰기 경로가 둘이었다 — 권위 있는 주 컬렉션
   (primary)과, 점진 도입 중인 멀티벡터 컬렉션(additive dual-write). 코드 구조상 primary 쓰기는
   함수 내부 try/except로 에러를 잡아 로깅만 하고 넘어갔고, 태스크 성공/실패는 dual-write 경로의
   결과로만 반영됐다. 그래서 **primary 쓰기가 매번 실패해도 태스크는 항상 succeeded**였다. 로그를
   grep하지 않으면 안 보이는 silent failure.

2. **create-guard가 스키마 변경을 기존 컬렉션에 전파하지 않았다.** 컬렉션 생성 코드가
   `if not has_collection(name): create_with_schema(...)` 형태였다. **컬렉션이 이미 있으면 스키마
   정의는 무시된다.** 몇 달 전 코드 스키마에 "테넌트 필터 필드"가 추가됐지만, 그보다 먼저 생성된
   dev 컬렉션은 구 스키마를 그대로 유지했다. 벡터DB는 암묵적 ALTER가 없으니 코드와 실데이터의
   스키마가 조용히 갈라진 채 굳었다.

실측으로 확정했다 — 라이브 컬렉션 스키마를 직접 조회하니 그 필드가 없었고 dynamic field도 비활성.
거부될 수밖에 없었다. 게다가 검색 경로도 그 필드로 필터링하고 있었으니 **쓰기뿐 아니라 읽기까지**
이 컬렉션에서는 깨져 있었다.

fix는 코드 변경이 아니라 **일회성 데이터 작업**이었다 — 코드 스키마는 처음부터 옳았으므로,
드리프트된 dev 컬렉션을 drop하고 서비스의 생성 경로(동일 스키마 + 인덱스 + load)로 재생성했다.
돌고 있던 bulk reindex가 새 컬렉션을 다시 채웠고, 재생성 직후부터 primary 쓰기가 성공 로그를
찍기 시작했다(ERROR 소멸).

마지막으로 **운영(prod) 영향을 read-only로 확인**했다. 같은 드리프트가 prod에도 있으면 prod 검색도
깨져 있다는 뜻이니까. prod 컬렉션은 그 필드를 이미 갖고 있었고(드리프트 없음) 정상 규모로 적재돼
있었다. 드리프트는 dev 한정이었고 prod는 손대지 않았다.

## 왜 했나 — 가치

이 이야기의 가치는 **"성공한 태스크가 사실은 실패하고 있었다"는 비대칭**에 있다. 멱등·재시도를
잘 챙긴 태스크라도, 성공 판정이 "여러 부수 쓰기 중 하나"에만 묶여 있으면 primary가 매번 실패해도
메트릭/상태는 초록불을 유지한다. dual-write를 "실패해도 본체 영향 없음"이라고 설계한 바로 그
안전장치가, 방향이 뒤집히자(가려야 할 쪽이 primary가 됨) 실패를 가리는 장치로 변했다.

두 번째 교훈은 create-guard 패턴이다. "없으면 만든다"는 멱등해 보이지만, 스키마가 진화하면
**기존 객체에는 영영 반영되지 않는** 잠복 함정이 된다. 코드 스키마와 실데이터 스키마가 갈라지는
순간을 잡는 방법(드리프트 감지 가드 또는 마이그레이션 단계)이 없으면, 다음 필드 추가 때 똑같이 재발한다.

세 번째는 디버깅 동선 — "succeeded 옆의 ERROR" 모순을 보고 곧장 실데이터 스키마를 조회(추측이
아니라 실측)했고, fix 후엔 운영 영향까지 read-only로 분리 확인했다.

## 외부에 공유해도 좋은 일반 교훈
- 벡터DB의 `if not has_collection: create_with_schema` 패턴은 **스키마 진화 시 기존 컬렉션에
  전파되지 않는다**(schema-on-write 저장소 일반의 동작).
- dual-write/shadow-write 도입 시 **태스크 성공 판정이 어느 쪽 쓰기에 묶였는지**가 silent-failure
  가능성을 좌우한다. "실패해도 본체 영향 없음" 주석은 방향이 바뀌면 위험해진다.
- 디버깅: **"succeeded 로그 바로 옆의 ERROR"**는 "성공 판정이 실제 핵심 작업을 반영하지 않는다"는
  1차 신호. 추측 대신 실데이터를 직접 조회해 확정.
- schema-on-write 저장소의 마이그레이션은 RDB의 ALTER와 달리 암묵적 전파가 없으므로 **드리프트
  감지 또는 명시적 recreate/마이그레이션 단계**가 필요하다.
- fix 후 **운영 영향을 read-only로 분리 확인**(dev에서 고쳤다고 prod도 같다고 가정하지 않기).

## 코드 / 설계 스니펫 (일반화)
```python
# 함정 1: create-guard — 컬렉션이 이미 있으면 스키마 정의는 무시된다.
def get_collection(name: str):
    if not has_collection(name):          # ← 여기 분기
        schema = build_current_schema()   #   기존 컬렉션엔 절대 실행되지 않음
        create(name, schema)
        create_index(name)
    return load(name)
```
```python
# 함정 2: dual-write가 실패를 가린다. primary는 삼켜지고, 성공은 secondary로만 판정.
def reindex(media_id):
    try:
        primary_upsert(media_id, ...)     # 매번 실패해도 ERROR 로깅만 하고 통과
    except Exception as e:
        logger.error("primary write failed: %s", e)
    secondary_dual_write(media_id, ...)   # 이게 성공하면 태스크는 succeeded
    # → 메트릭/상태는 초록불, primary는 비어 감
```
```text
# 진단: "succeeded 옆의 ERROR" 모순 → 추측 대신 실데이터 스키마 직접 조회.
# (의사코드) connect(vector_db); print(collection(name).schema.fields)
# 기대: [pk, tenant_filter_field, source_text, embedding]
# 실제: [pk, source_text, embedding]   ← tenant_filter_field 누락 = 드리프트 확정
# fix: drop(name); get_collection(name)        # 코드 경로로 동일 스키마 재생성
# 운영 확인: 같은 조회를 prod에 read-only로 1회 — 필드 세트만 비교
```

## 참고
- 벡터DB(schema-on-write) 일반: 컬렉션 스키마, dynamic field, 생성/인덱스/load 라이프사이클.
- schema-on-write 저장소의 마이그레이션 일반론(암묵적 ALTER 부재).
