---
team: backend
proposer: "operator-direct (content cross-cuts backend/frontend/infra agent adoption)"
date: 2026-05-31
topic: "dogfooding으로 키운 멀티 에이전트 코딩 하네스 — tdd-batch에서 티어 라우팅까지, 수술실 비유"
suggestedCategory: "meta"   # enum(backend|frontend|infra|ml|meta) 매핑: engineering-process → meta
suggestedTags: ["llm-agents", "pair-programming", "claude-code", "codex", "agent-os", "dogfooding", "developer-workflow"]
redactionReviewed: true
---

> 이 파일은 백엔드 private repo의 raw 글감(`2026-05-31-agent-os-dogfooding-journey.md`)을
> redaction 통과시킨 **정제본**이다. 적용한 redaction은 아래 "redaction 기록" 참조.

## 무엇을 했나

1인 개발 환경에서 LLM 코딩 에이전트의 **하네스(harness)**를 세 단계로 진화시켰다.
최종 형태는 작업/이슈를 티어로 라우팅해, 낮은 티어는 단순·빠르게, 높은 티어는 다중
모델의 적대적 검토를 거치는 의사결정 구조다. 백엔드·프론트엔드·인프라 세 코드베이스에
같은 패턴으로 적용 중.

진화 단계:
- **v0 (skeptic)**: 단일 코딩 에이전트(Claude Code)로 시작. 프로젝트는 여러 벤더(GPT → Gemini → Claude)를 거쳤고, 주변에서 다른 에이전트(Codex) 추천을 들었지만 반신반의.
- **v1 — `tdd-batch`**: 한 모델이 plan + test 코드 작성, 다른 모델이 테스트를 통과시키는 구현. 코드 품질은 매우 높았지만 **몇 줄짜리 fix에도 핑퐁이 길어 속도가 너무 느렸다**.
- **v2 — `pair-agent`**: 테스트 강제 제거. 한 모델이 코드, 다른 모델이 리뷰. 빠르지만 v1보다 안전 마진이 낮다.
- **v3 — 티어 라우팅(현재)**: 낮은 티어는 v2 스타일로 빠르게. **보안·비즈니스 로직·난이도·아키텍처 임팩트가 높은 티어는 "agent committee"** — 여러 프런티어 모델이 사전 비판적 회의로 변경 계획을 짜고, 합의된 방향으로 구현이 진행되는 동안 모두 참관(결정 로그 + 리뷰 트레일).

세션 간 통신은 **inter-session agent communication 도구**로 처리(cross-repo 핸드오프와 페어링이 운영자 수동 복사붙이기 없이 돌아가게 함).

## 왜 했나

"두 모델을 cross해서 쓰면 단일 모델보다 성능이 올라간다"는 가설에서 출발. 근거는 **각
벤더가 training 방향/방법론을 공유하지 않으니 장단점 분포가 서로 다를 수밖에 없다**는
단순한 추론(이전 Gemini+GPT 병용 경험에서 배움).

핵심 통찰: **품질과 속도는 같은 자리에서 살 수 없는 자원.** v1은 품질↑ 속도↓, v2는
품질中 속도↑. 그래서 **티어로 가르는 게 자연스럽다** — 모든 작업에 v1은 비효율,
모든 작업에 v2는 위험. 작업 자체가 자기 티어를 갖고 있다.

비유: **수술실.** 맹장 수술은 한 명의 숙련의가 처리한다(낮은 티어, pair). 복잡한 다학제
수술은 각 전문영역 전문가들이 사전에 강도 높은 계획 회의를 하고, 모두 참관 가능한 상태로
진행한다(높은 티어, committee). 두 방식 다 정당하고, **무엇을 어디로 보낼지 정하는
트리아지가 시스템의 핵심.**

## 외부 공유 OK (정제 완료)
- cross-model pairing이 품질을 올린다는 일반 메시지 + 근거(벤더 간 training 비공유).
- 세 단계 진화 narrative(tdd-batch → pair-agent → 티어 라우팅) — 일반화된 디자인.
- 수술실 비유(맹장 vs 다학제) — 티어 라우팅 직관화 훅.
- dogfooding 가치, inter-session 통신 도구의 필요성.
- 영감 출처: Andrej Karpathy의 공개 CLAUDE.md(공개 글 인용), 소규모 YouTube 크리에이터의 하네스 컨셉(익명 처리).

## redaction 기록 (raw → 정제본)
- **모델 버전 식별자 제거**: 구체 버전(예: Opus/GPT/Gemini 숫자) 미사용. 도구/벤더명(Claude Code, Codex, GPT, Gemini)은 버전 없이 유지(하이브리드 톤).
- **제품명**: Ascendy 노출 OK(블로그 소속, case study 톤).
- **내부 경로 제거**: 점 붙은 하네스 디렉토리 경로 형태는 글에도 이 정제본에도 쓰지 않음. 하네스 *이름*(tdd-batch/pair-agent)은 유지.
- **비즈니스 도메인 모듈명**: raw 본문에 없음(외부공유 가이드에만 예시). 글에 미포함.
- **inter-session 통신 도구**: 공개 URL 미확인 → 일반화("inter-session agent communication 도구"). 사용자 확인 시 실명 가능.
- **YouTube 채널**: 익명 추상화("a small YouTube creator"). 소규모 채널이라 실명은 정제본에도 적지 않음(누출 방지). owner 동의 확인 시 실명 credit 추가 가능.
- **오픈소스화 검토 언급 제외**: 미announce 로드맵 → 글에서 뺌(사용자 결정).
- **사내 incident/회고**: raw에 없음(meta narrative만).
- Karpathy CLAUDE.md URL: 글은 이름만 언급(링크 없음)으로 발행 가능. 정확 출처 URL은 **후속 확인 항목(발행 차단 아님)** — 확인되면 링크 추가.
