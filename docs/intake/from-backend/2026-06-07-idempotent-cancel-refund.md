---
team: backend
date: 2026-06-07
topic: "비용이 발생하는 비동기 작업의 '전체 취소 + 환불'을 멱등하게 — 환불을 아이템 단위 원자 트랜잭션으로, 정리를 마커 기준 재실행 가능하게, 작업의 터미널 상태 전이를 맨 마지막에 두면 크래시·재시도에서 이중환불도 고아 리소스도 안 생긴다. 동시 행위자(엔드포인트 vs 워커) 전이는 전부 조건부 UPDATE+rowcount."
suggestedCategory: "backend"
suggestedTags: ["idempotency", "distributed-systems", "race-condition", "transactions", "reliability"]
relatedDecisions: []
redactionReviewed: true
---

> backend 팀 raw 인테이크의 redaction 정제본. raw는 backend private repo의 `docs/blog-intake/`.
> 발행 글 `sourceIntake`가 이 파일을 가리킨다. **Class A 없음**(전부 머지·배포 완료, 미해결 약점
> 없음). **Class B 없음.** **Class C 일반화**: 테이블/컬럼명·엔드포인트 경로·PR 번호·WS 이벤트명·
> 엔진별 포인트 단가(과금 수치=비즈니스 민감) → 제외/일반화. redaction 매핑은 여기 적지 않는다.

## 무엇을

비용이 발생하는(아이템별 과금 + GPU 호출) 사진 일괄 보정 기능에 **"작업 전체 취소 + 환불"**을
추가했다. 요구: 실행 중이면 다음 아이템 경계에서 중단, 아직 결정 안 난 성공분은 포인트 환불,
임시 산출물 정리. 적대적 plan review가 1라운드에서 blocker 3개를 정확히 짚었고, 설계가 다음
멱등성 패턴으로 수렴했다.

## 패턴 (재실행/크래시 안전)

1. **부활(resurrection) race — 조건부 claim.** 실행 워커의 "running 전이"가 무조건 UPDATE면,
   취소 엔드포인트가 pending 작업을 취소한 직후 워커가 그 위에 running을 덮어써 작업이 *부활*한다.
   claim을 `UPDATE ... WHERE status IN (...) AND cancel_requested=false` + rowcount 체크로 바꾸면
   닫힌다. at-least-once 재전달도 같은 조건으로 안전하게 재-claim.
2. **이중환불 — 마커와 잔액을 같은 트랜잭션에.** "환불 후 상태 변경"을 별개 커밋으로 하면 그 사이
   크래시 시 재시도가 또 환불한다. 아이템마다 `UPDATE item SET decision='cancelled' WHERE decision
   IS NULL`(rowcount 체크) + **서버사이드** 잔액 증가(`SET points = points + cost`, read-modify-write
   아님)를 **한 커밋**으로 묶으면, 재시도는 이미 뒤집힌 아이템을 건너뛴다.
3. **고아 리소스 — 정리는 마커 기준 전체 재스캔.** 2의 마커가 커밋된 직후 크래시하면 "미결정
   아이템만 정리"하는 패스는 그 아이템을 영원히 건너뛴다(이미 결정됨). 정리 패스는 처리 대상을
   `decision='cancelled'` **마커 기준**으로 매번 전체 재스캔해야 한다 — 외부 저장소 삭제는
   missing-key가 no-op이라 재실행이 공짜다.
4. **터미널 전이는 맨 마지막.** 작업을 'cancelled'(터미널)로 바꾸는 건 환불·정리가 다 끝난 뒤다.
   중간 크래시는 작업을 non-terminal로 남기고, 재호출이 같은 teardown에 다시 들어온다(중복 호출
   가드는 터미널 도달 후에만). 따라서 **정리 실패를 삼키고 터미널로 가면 안 된다** — 실패는 예외로
   전파해 재진입 가능성을 보존한다.
5. **완료 vs 취소 경합 — 완료도 조건부.** 마지막 아이템 처리 후 취소가 도착하는 창이 있다. 완료
   전이도 `UPDATE ... WHERE cancel_requested=false`로 만들고, rowcount 0이면 완료 대신 teardown으로
   라우팅한다.
6. **실행 중 취소 응답은 ACCEPTED.** 엔드포인트가 실행 중 작업을 동기로 teardown하면 워커와 환불
   race가 난다. 플래그만 세우고 "접수됨"으로 응답한 뒤, 워커가 아이템 경계에서 teardown하고 최종
   합계를 푸시 이벤트로 알리는 쪽이 race-free. 폴링 주기는 "초과 처리 1단위"가 허용 비용이 되게
   잡는다(여기선 아이템마다 — 비싼 호출 1번이 SELECT 1번보다 훨씬 비싸므로).

## 왜 (교훈)
- 멱등성은 "한 번 더 실행해도 같은 결과"가 아니라 **"어느 지점에서 죽어도 재시도가 수렴"**으로
  설계해야 한다. 그러려면 모든 중간 상태가 재시도의 올바른 출발점이어야 하고, 그 핵심이 **터미널
  상태 전이를 맨 마지막에 두는 것**이다.
- 상태 기계에 **동시 행위자(엔드포인트 vs 워커)**가 생기는 순간, 모든 전이는 **조건부 UPDATE +
  rowcount 체크**로. (`SELECT FOR UPDATE`는 테스트 DB가 못 따라오는 경우가 많아 차선이었다.)
- blocker들(부활 race·이중환불·고아 리소스)은 전부 적대적 plan review가 *구현 전에* 잡았다 —
  3라운드 수렴 비용 < 프로덕션 이중환불 디버깅 비용.

## 외부에 공유해도 좋은 부분
- "비용 발생 비동기 작업의 취소+환불 멱등성" 6패턴(조건부 claim/마커+잔액 한 트랜잭션/마커 기준
  재스캔 정리/터미널 마지막/완료도 조건부/실행 중 취소는 ACCEPTED).
- "멱등성=어느 지점에서 죽어도 수렴", 동시 행위자엔 조건부 UPDATE+rowcount라는 일반 분산설계 교훈.
- 적대적 plan review가 구현 전에 race를 잡는 비용 대비 효과(메타).

## 외부에 공유하면 안 되는 부분 (redaction 시 참고)
- 구체 테이블/컬럼명·엔드포인트 경로·PR 번호·WS 이벤트명 → 일반화.
- **엔진별 포인트 단가(과금 수치)** → 과금=비즈니스 민감, 수치 일절 제외("비용이 드는 호출"로만).
- (어떤 식별자였는지는 여기 열거하지 않는다 — 이 파일도 public.)
