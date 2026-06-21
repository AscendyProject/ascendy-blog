---
team: frontend
date: 2026-06-17
topic: "'동기화 완료'인데 0장 업로드 — client scan cap이 새 사진을 가린 coverage gap. 프론트가 prod 로그 없이 9-가설 ranking으로 독립 진단→백엔드 prod 로그와 같은 답 수렴(secondary race vs root cause 분리). 청크 동기화 fix를 LLM 리뷰어가 'tie-safe 아님(plateau 누락)' 데이터분포 버그로 잡음."
suggestedCategory: "frontend"
suggestedTags: ["debugging", "silent-failure", "code-review", "frontend", "data-distribution"]
source: "frontend 팀 인테이크 2건(2026-06-16 독립진단·수렴 + 2026-06-17 Pattern B·tie-safety)의 합본 정제본."
redactionReviewed: true
---

> frontend 팀 raw 인테이크 2건의 합본 정제본. **redaction(두 글감 지시 준수):** 내부 user 식별자·
> prod DB 테이블/컬럼명·서버 로그 포맷·내부 API endpoint·절대 수치(스캔 cap·카운트·청크 크기·버전 코드)·
> 특정 메신저 앱명·내부 파일/PR/SHA·에이전트 모델명은 **전부 일반화**("client scan cap", "외부 메신저 앱
> 일괄 import", "독립 LLM 리뷰어", "이번/다음 버전"). (이 정제본도 public이므로 redact 대상의 literal
> 값을 여기 적지 않는다.) 제품 도메인(사진 라이브러리 동기화)은 공개 사실. 시크릿·생체정보 없음.

## 증상 — '동기화 완료'인데 0장

운영자: "특정 날짜 이후 찍은 사진이 자동·수동 동기화 모두 안 올라온다." 그런데 앱은 **"동기화
완료" 토스트**를 띄운다. 0장 업로드된 채로. **조용한 성공(silent success)** — 가장 위험한 실패 모드.

## 1부 — 프론트 독립 진단이 백엔드 prod 로그와 수렴

- **프론트는 백엔드 prod 로그를 못 보는 상태**에서, 코드만 보고 **약 9개 가설을 ranking**. 최상위
  의심: 자동/수동 동기화가 **병렬로 sync를 시작**해 서로 세션을 interrupt → 첫 세션 완료 처리가
  silent no-op. 그리고 sync 시작 실패가 **사용자에게 안 보임**(콘솔만 찍고 조용히 반환).
- 프론트가 단독으로 고칠 수 있는 3개 결함을 한 PR로 닫음 — single-entry 락(병렬 방지), run-scoped
  cancel(취소 플래그 영구 silencer 제거), 마지막 sync 에러를 UI에 노출.
- 그 뒤 **백엔드가 prod 구조화 로그 + DB 집계를 hand-off.** 세 가지가 한 번에 결판:
  1. **새 사진이 서버에 *도달조차* 안 함** — 클라이언트가 보낸 hash 중 새 건 0개. 백엔드는 깨끗.
  2. **라이브러리가 client scan cap을 넘김** — 클라이언트가 "newest-N개"만 스캔하는데, 라이브러리가
     그 cap을 넘으면 cap 바깥의 새 사진은 스캔에 *아예 안 보인다* → hash payload에 못 들어감.
  3. **세션 interrupt가 prod에서 관측됨** — 프론트 #1 가설(병렬 race)이 그대로 확인됨.
- **핵심 분리:** race는 *secondary*(진짜 버그지만 사용자의 버그는 아님), **scan cap coverage gap이
  root.** "진짜 버그 하나 닫음 ≠ 사용자의 버그 닫음."

## 2부 — root cause fix와 리뷰어가 잡은 데이터분포 버그

- **fix = 청크 동기화(Pattern B).** cursor 기반으로 라이브러리를 청크 단위로 walk, **한 번에 한 세션만**
  열고 그 세션을 완주한 뒤 다음 청크로. 백엔드 변경 0(이미 hash idempotent).
- **리뷰어(독립 LLM)가 v1에서 결함 D1을 잡음 — cursor가 tie-safe가 아니다.** cursor 키를
  *타임스탬프 하나*로만 쓰면, **같은 시각에 청크 크기 이상의 사진이 몰리는 경우**(외부 메신저 앱
  일괄 import, 클라우드 복원 등) strict-advance 분기가 그 *plateau* 안쪽 미처리 행을 **영구 누락**한다.
  - 트레이스: 같은 타임스탬프 사진이 청크 크기보다 많을 때, native가 매번 *어떤* 청크를 주는지는
    구현 의존. 운 나쁘면 같은 청크 반복 → "새 건 0, raw는 가득" 분기 → cursor를 strict-advance →
    plateau 나머지 영구 누락.
  - **lint/typecheck/단위테스트가 못 잡는 결함** — 코드 본문엔 안 보이고, *데이터 분포를 상상*해야
    보인다. "타임스탬프가 unique하다"는 *적히지 않은 가정*에 의존했고, 그 가정이 깨지는 시나리오를
    리뷰어가 떠올림.
- **v2 fix:** cursor를 **compound**(타임스탬프 + collection 내 단조증가 id)로, native에 secondary
  정렬 추가, **strict-less** selection으로 직전 청크 끝 바로 아래부터. image/video collection은 id 공간이
  달라 **두 단계로 분리해 walk.** → **plateau 크기와 무관하게 forward progress 보장**(plateau 가정 자체 제거).
  순수 cursor 함수로 분리 + plateau 시나리오 명시 단위테스트.

## 메타 인사이트 (글의 값)

- **fix→fix→fix 시퀀스가 root cause로 수렴한다.** secondary(사용자가 *볼 수 있는* 실패)와
  root(데이터로만 보이는 실패) 둘 다 닫아야 했다. 한쪽만으론 "동기화 완료·0장" 또는 cancel-stall이
  그대로 남았을 것.
- **LLM 리뷰어의 값은 *데이터 분포 상상*에서 나온다.** lint는 타입을, typecheck는 시그니처를,
  테스트는 *적힌* 가정을 본다. 리뷰어는 *적히지 않은* 가정을 의심한다.
- **v1을 빨리 ship했으면 '가짜 완결감'을 만들 뻔했다.** 리뷰 라운드 한 번이 운영자 빌드→재발견→
  다음 라운드의 비용을 절약. 리뷰어 채택을 정당화하는 종류의 사건.
- **조용한 성공이 가장 위험하다.** "완료" 토스트 + 0장 업로드. 에러가 안 보이면 1차 의심은
  *입력이 조용히 잘렸는가*(scan cap이 데이터를 가렸는가)여야 한다.

## 외부에 공유하면 안 되는 부분 (redaction 체크)

- 내부 user 식별자·DB 테이블/컬럼명·서버 로그 포맷·내부 API endpoint·절대 수치(cap/카운트/청크/버전)·
  특정 메신저 앱명·내부 파일/PR/SHA·에이전트 모델명 — 위 일반화로 처리. 시크릿·생체·고객 식별 없음.
