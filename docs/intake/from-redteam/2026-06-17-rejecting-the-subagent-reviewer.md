---
team: redteam
date: 2026-06-17
topic: "기능을 거부하는 법 — redteam이 #37(pluggable reviewer execution)의 3단계 중 1개만 출시하고 2개를 '설계상 거부'로 종결. 거부를 흔적 없이 버리지 않고 결정문 + 가드레일 + 되살림 조건으로 남긴 OSS 결정 기록. 자기-리뷰 붕괴 가드의 family-vs-raw-key 식별자 정규화 함정 포함."
suggestedCategory: "meta"
suggestedTags: ["decision-record", "oss", "agent-pair", "yagni", "trust"]
source: "redteam 팀 글감(2026-06-17 rejecting the sub-agent reviewer)의 정제본. 캐논은 public repo gh로 직접 재검증."
redactionReviewed: true
---

> redteam 팀 raw 글감의 정제본. **Class A/B 없음** — 전부 public OSS(`AscendyProject/redteam`, Apache-2.0).
> 보안 디테일(자기-리뷰 가드 우회)은 **결정문에 가드레일이 박힌 *해소된* 설계 결정**이고, 본문은 이를
> *exploit 레시피*가 아니라 **일반화된 식별자-정규화 교훈**으로만 다룬다. 거부된 기능(step 5)은
> 애초에 구현되지 않았으므로 라이브 노출이 아니다. 시크릿·사내 호스트·경로 없음.

## 캐논 (gh 재검증, 2026-06-21)

- 이슈 **#37 CLOSED/COMPLETED**(엄브렐러 — "pluggable reviewer execution"). **#67 CLOSED/NOT_PLANNED**(step 5 focus).
- **PR #68**(step 5 거부 결정문) **MERGED**(2026-06-17). 결정문: `docs/decisions/2026-06-17-reviewer-transport-and-subagent.md`(repo 내 존재 확인).
- step 4(fallback ladder)는 **0.3.0에 출시**. **현재 최신 릴리스 v0.5.1**(2026-06-19). Apache-2.0.
  - ⚠️ "0.3.0이 현재"라고 쓰지 말 것 — step 4가 *들어간 시점*이 0.3.0. 현재 버전은 0.5.1.
  - ⚠️ "열린 이슈 0건"이라고 쓰지 말 것 — 현재 open 3건(별개 작업).

## 무엇을 했나

#37은 어드버서리얼 리뷰어를 어댑터 seam 뒤에서 어떻게 구동할지를 3단계로 쪼갰다:

- **step 4 — fail-closed fallback ladder:** 1차 헤드리스 리뷰어가 *인프라*로 실패(CLI 없음/미인증/타임아웃/파싱불가)할 때만 작동하는 설정 가능한 사다리. → **0.3.0 출시.**
- **step 6 — 터미널 멀티플렉서 스크린스크래핑 트랜스포트:** **거부.**
- **step 5 — 서브에이전트 리뷰어 어댑터**(Claude Code 세션 안에서 Agent 툴로 보안-리뷰어 서브에이전트를 띄움): 이번 사이클 **거부**(운영자 결정). 포커스 이슈 #67로 분리 → NOT_PLANNED로 닫음.

순효과: **#37 엄브렐러 완전 종결 — 3단계 중 1개 출시, 2개 거부.** 거부 결정문(PR #68)을 Codex가 read-only 샌드박스에서 실제 브랜치 코드를 열어 교차리뷰, 1라운드 APPROVED.

## 왜 거부했나

step 5의 유일한 이득은 "세션 내 가시성/스티어링"뿐. 헤드리스 `claude -p --permission-mode plan` 리뷰어가
이미 "Claude가 리뷰어인 cross-provider" 케이스를 커버한다. 한계 이득을 위해 (a) 새 실행 표면(엔진의
*project-agnostic* + *zero-runtime-deps* 두 불변식을 압박)과 (b) 까다로운 보안 선결조건을 떠안는 건
수지가 안 맞았다. **거부도 정당한 엔지니어링 결정** — YAGNI를 결정문으로 남기되, 되살릴 때 다시
통과해야 할 가드레일을 함께 보존했다.

## 보안 선결조건 — 일반화된 교훈 (식별자 정규화)

자기-리뷰 붕괴 가드는 worker는 *provider family*(`"claude"`/`"codex"`)로, reviewer는 *raw 어댑터 키*로
비교한다. 그래서 `"claude-subagent"` 같은 새 키를 추가하면 `"claude-subagent" != "claude"`로
**cross-provider인 척 통과 → Claude가 Claude를 리뷰하는 자기-리뷰가 가드를 우회**할 수 있었다.
plan_review 단계에서 HIGH로 잡혔고, 결정문에 *하드 선결조건*으로 박았다: 어떤 서브에이전트 결과도
자동 리뷰 게이트를 통과하기 전에 **key→family 정규화부터** 한다.
→ 교훈: **한쪽은 정규화된 family로, 다른 쪽은 raw 키로 비교하면, 키 하나로 동등성 검사가 뚫린다.** 비교
전에 양쪽을 같은 정규형으로. (식별자·권한·동일성 검사 일반에 적용.)

## 토론 트리거 — 해당 없음(정직하게 비움)

이번 사이클엔 Claude↔Codex 3+라운드 substantive 갈림이 없었다(거부 결정문 Codex 리뷰는 1라운드
APPROVED). 비워 둔다. (앞선 #37 step 4 plan_review는 실제로 3~4라운드 갈렸으나 이 인테이크 범위 밖.)

## 앵글 / 외부 공유 가능

- **"무엇을 *안* 만들었고 왜인가"**라는 OSS 결정 기록 패턴 — 거부를 흔적 없이 버리지 않고 분석·가드레일·되살림 조건을 남긴다.
- 식별자 정규화 함정(family vs raw-key) — 일반화 가능.
- fail-closed 사다리 원칙: 유효한 리뷰 판정(CHANGES_REQUESTED 포함)은 절대 fallback 트리거가 아니고, fallback의 APPROVED는 cross-provider+read-only+클린파싱일 때만 신뢰.
- 번호·상태는 공개 repo 검증 가능(#37/#67/#68, v0.5.1, Apache-2.0).

## 외부에 공유하면 안 되는 부분

- 특별히 없음(전부 공개 결정문/이슈/PR). 보안 디테일은 일반화 교훈으로만, exploit 단계 서술 금지.
