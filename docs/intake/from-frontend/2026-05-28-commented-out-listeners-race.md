---
team: frontend
proposer: "Claude (ascendy-frontend)"
date: 2026-05-28
topic: "주석으로 끈 기능은 되살아나지 않는다 — 복원 누락 + double-trigger race"
suggestedCategory: "frontend"
suggestedTags: ["capacitor", "concurrency", "race-condition", "incident-prevention", "vue"]
redactionReviewed: true
---

> 프론트엔드 private repo raw 글감의 redaction 정제본. 기술 중심 톤(긴급 차단의 사유는
> '원치 않는 트리거를 막기 위함' 수준으로 일반화 — 동의/프라이버시 서사는 최소화).
> 내부 경로/엔드포인트/PR번호는 일반화.

## 무엇을 했나

네이티브 갤러리 자동동기화가 "토글은 켜져 있는데 아무것도 안 올라간다"는 제보. 추적 결과
자동 재트리거 listener **두 개가 주석처리된 채 방치**돼 있었다:

- 네트워크 재연결(WiFi) 시 동기화 재시작 listener.
- 앱 foreground 복귀 시 새 미디어 감지 listener.

cold-start 트리거 하나만 살아있어서, 앱을 처음 켤 때 WiFi+새 사진이 동시에 맞지 않으면
자동동기화가 사실상 안 돌았다. 두 listener를 복원하고, 복원하면서 드러난 동시성 버그를 같이 고쳤다.

## 왜 했나

원래 자동동기화는 동작했는데, **특정 진입 시점에 원치 않게 동기화가 시작되는 것을 긴급히 막으려고**
listener를 주석처리했다. 의도한 후속은 "기본 OFF + 조건 게이트가 켜지면 그때부터 동기화"였다.
조건 게이트는 제대로 들어갔는데(동기화 진입 두 지점 모두 게이트 검사), **트리거 복원이 누락**됐다.
결과적으로 "게이트는 저장되는데 트리거가 죽어있는" 상태가 한참 남았다.

두 번째 교훈: 복원한 두 listener는 둘 다 같은 전역 락을 검사하는데, **검사 시점과 set 시점 사이에
await가 끼어 있었다.** 두 이벤트(앱 resume + WiFi 재연결)가 거의 동시에 발생하면 둘 다
`if (running) return` 가드를 통과한 뒤, 한참 뒤에야 각자 락을 set → 같은 동기화를 두 번 시작하는
race. 리뷰가 이걸 잡아서, 락을 **싸구려 동기 predicate 직후·첫 await 전에 동기적으로 claim**하도록 고쳤다.

## 외부 공유 OK
- "기능을 주석으로 끄면 복원이 누락된다"는 incident 패턴. 긴급 차단은 코드 주석 대신 (a) 명시 feature flag (b) early-return + TODO(만료조건)로.
- 조건 게이트와 trigger는 별개 축 — 게이트 저장만 테스트하면 trigger 회귀를 놓친다.
- event listener double-trigger race: 여러 listener가 같은 작업을 재진입 락으로 막을 때, "check-then-act"의 check와 act 사이에 await가 있으면 락이 무력화된다. 락은 술어 통과 직후·첫 await 전에 동기 claim, 게이트 검사는 try 안, finally에서 release.
- Capacitor 멀티 트리거(cold-start + 네트워크 + 앱 상태) 재진입-안전 패턴.

## redaction 기록 (일반화)
- 긴급 차단 사유: '원치 않는 트리거를 막기 위함' 수준으로 일반화(동의/프라이버시 incident 서사 최소화 — 사용자 결정).
- 내부 endpoint 경로·컴포넌트 파일 경로·PR번호·test 계정 식별자: 일반화/제거(정제본에도 실명 미기재).
- 동기화 시작 API: "동기화 시작 함수"로 추상. store는 Pinia 관례 이름 수준만.
