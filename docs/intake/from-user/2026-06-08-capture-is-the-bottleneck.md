---
team: user
date: 2026-06-08
topic: "AI 도구가 내 불평을 알아서 배워서 스스로 개선하면 좋겠다는 질문에서 출발 — 자가개선 루프(Claude Code의 learnings loop 등)는 이미 생겼지만, 닫히려면 교정이 'capture'돼야 하고 capture는 여전히 수동·취약한 단계다. 어려운 건 'improve'가 아니라 늘 'capture→route'였다."
suggestedCategory: "meta"
suggestedTags: ["ai-agent", "feedback-loop", "self-improvement", "developer-tools", "process-design"]
source: "운영자 질문에서 출발 + 발행 시점 web_search fact-check. 사용자 직접 지정 소스."
redactionReviewed: true
---

> 운영자가 던진 질문("내가 쓰는 AI 도구가 내 불평/에러를 로그로 알아서 진단해 스스로 개선하나?")
> 에서 출발한 글. 사용자 직접 지정 소스(`sourceIntake` 면제지만 provenance로 남김). 제품 사실은
> **발행 시점 web_search로 fact-check**하고 출처 귀속. **사내 정보 없음**(전부 공개 문서 + 이미
> 공개된 "이 블로그는 Claude Code로 쓴다" 수준). 톤=비판 아닌 보편 설계 긴장, 자뻑/디스 회피.

## 출발 질문 (운영자)

"내가 너(AI 코딩 도구)를 쓰다가 에러나 불편을 말하면, 그걸 로그로 알아서 진단해서 스스로
개선하는 self-healing loop 같은 게 있나? 세션 중에 '이거 불편해'라고 하면 그게 어딘가 기록돼
제품 개선으로 이어지나?"

## fact-check (2026-06, 출처 귀속 — 단정/추측 분리)

전제를 좁혀야 한다. "그런 루프가 없다"는 *이제 부정확*하다. 루프는 생겼고, 종류를 구분해야 한다:

- **있다(스킬·명령 레벨)**: Claude Code의 "learnings loop" — 스킬을 쓰다 교정해주면 그 교정이
  스킬의 *지시문*(learnings.md)에 다시 써져 누적된다. 모델 가중치가 아니라 명령 레벨의 자기개선.
  (출처: MindStudio·mcpmarket 등 공개 자료. 빌트인 보장 기능이라기보다 스킬/패턴 형태 — 신중 표현.)
- **여전히 사람 경유(제품 레벨)**: 세션 중 "이거 불편해"가 제공사로 자동 라우팅되진 않는다 —
  사용자가 `/feedback`을 직접 눌러야 한다(별도 보고 흐름). 데이터 수집은 항목별 opt-out: 텔레메트리
  `DISABLE_TELEMETRY`, 피드백 명령 `DISABLE_FEEDBACK_COMMAND`, 서베이 `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY`
  (공식 Claude Code Data Usage 문서). 비공식 해설이 아니라 공식 문서로 귀속할 것.
- **없다(실시간 모델 자가치유)**: 내 에러를 보고 모델이 실시간으로 자기를 고치는 건 아니다.

→ 핵심: 루프는 있는데 **범위가 좁고(스킬 지시문), 무엇보다 *capture*에 달려 있다** — 누군가
그 교정을 learnings.md에 *적어 넣거나* `/feedback`을 *눌러야* 닫힌다.

## 통찰 (글의 척추)

어려운 건 'improve'가 아니었다. **늘 'capture→route'였다.** 자가개선 메커니즘(improve)은
이미 존재한다. 그런데 그게 닫히려면 *교정이 포착돼 올바른 자리로 흘러가야* 하고, 그 capture
단계가 여전히 수동·취약하다. 이건 우리가 [monitoring 글]에서 본 그 끊긴 고리 — "측정이 아니라
route" — 와 정확히 같은 모양이고, [대화-패리티 글]의 "피드백은 폼 찾기가 아니라 대화로 와야
한다"와도 직결된다.

## 왜 capture를 수동으로 남기나 (공정하게)

이걸 "게으름"으로 읽으면 안 된다. capture를 자동화하지 않는 데는 **정당한 트레이드오프**가 있다:
- **프라이버시** — 세션의 모든 불평을 자동 수집·전송하면 감시처럼 느껴진다. opt-in(`/feedback`)과
  opt-out 토글은 그 경계를 사용자에게 준다.
- **신호/잡음** — 모든 투덜거림이 제품 신호는 아니다. 명시적 행동(버튼/명령)이 의도를 거른다.
- **동의** — 교정을 어디론가 흘려보내는 건 사용자 동의 위에서만 안전하다.
즉 capture가 수동인 건 *결함*이 아니라 *선택*이기도 하다. 다만 그 선택의 비용은 "신호가 증발한다".

## "좋은 capture"는 어떻게 생겼나
- **대화로**: 불평을 폼 찾아 적는 게 아니라, 그 자리에서 말하면 잡힌다(대화-패리티).
- **동의 위에서**: 잡되, "이거 이슈로 올릴까요?"처럼 사용자 동의를 받고 라우팅.
- **닫힌 루프로**: capture→route→improve→재측정까지 이어져야 가치(monitoring 글).

## 외부에 공유해도 좋은 부분
- "자가개선 루프(improve)는 이미 생겼지만 병목은 capture→route"라는 통찰.
- Claude Code learnings loop를 *현재 긍정 사례*로 든 fact(출처 귀속, 신중 표현).
- capture를 수동으로 남기는 정당한 트레이드오프(프라이버시·신호/잡음·동의) — 공정한 양면 서술.
- monitoring-closed-loop(capture→route)·conversational-parity(피드백은 대화로)와 시리즈 연결.
- "이 블로그를 쓰는 도구 자체에서 보이는 보편 긴장"이라는 1차 경험 프레임(이미 공개된 사실 수준).

## 외부에 공유하면 안 되는 부분 (redaction 시 참고)
- 사내 정보 없음 — 전부 공개 문서 기반. Ascendy 내부의 Claude Code 사용 세부(에이전트 구성 등)는
  이미 공개된 수준 외엔 더 적지 않는다.
- 제품 사실은 반드시 출처 귀속 + "스킬/패턴 형태"처럼 신중 표현(빌트인 단정 금지).
