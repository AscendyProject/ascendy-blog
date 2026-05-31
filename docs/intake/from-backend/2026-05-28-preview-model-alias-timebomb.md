---
team: backend
proposer: "Claude (ascendy-backend)"
date: 2026-05-28
topic: "프리뷰 모델 alias가 GA 후 폐기되며 한 경로만 404 — 분기 비대칭 + 모델 수명주기 가드"
suggestedCategory: "backend"
suggestedTags: ["llm", "model-lifecycle", "regression-testing", "incident-prevention", "multi-provider"]
redactionReviewed: true
externalMaterials:
  - kind: doc-reference
    source: "https://ai.google.dev/gemini-api/docs/models"
    license: "external-public"
    usage: "프리뷰/GA 모델 수명주기 사실 확인용 공개 문서 인용"
---

> 백엔드 private repo raw 글감의 redaction 정제본. 인시던트(특정 모델 경로 404)는 사용자
> 승인 하에 공개(remediation 머지 완료) — 예방 교훈 중심 톤. 모델 라인업/내부 구조는 일반화.

## 무엇을 했나

멀티 프로바이더 에이전트 채팅에서 **한 프로바이더 경로만 항상 404**가 났다(나머지는 정상).
원인은 두 겹:

1. **분기 비대칭**: 런타임 모델 선택 미들웨어가 일부 프로바이더에 대해서만 명시 클라이언트로
   override하고, 문제의 프로바이더엔 `None`을 반환 → override 없이 에이전트의 **base 모델**로
   fall through.
2. **base가 프리뷰 alias였다**: 그 base 모델 id가 **프리뷰 alias**로 고정돼 있었고, 프로바이더가
   GA 전환 후 이 프리뷰 alias를 폐기("no longer available", 404)하면서 그 경로만 죽었다.
   (우리 경우 그 프로바이더가 Gemini였다 — 프리뷰→GA 폐기는 공개된 모델 수명주기 사실.)

수정은 base를 GA id로 교체하는 한 줄 + 폐기 임박 세대도 함께 교체. 추가로 **회귀 가드 테스트**:
설정된 모든 모델 id가 `-preview` 또는 sunset 세대 패턴을 포함하면 실패 — 단 "현재 정답 id"를
핀하지는 않는다(그 id도 언젠가 폐기되므로).

## 왜 했나

- 프리뷰 모델은 편하지만 **GA 전환 시 alias가 사라진다.** 코드에 프리뷰 id를 박으면 시한폭탄.
- "한 모델만 깨지는" 버그는 보통 **분기 비대칭**에서 온다 — 그 경로만 fall-through라 base id에 직접 노출.
- 회귀 테스트를 "정답 핀"이 아니라 **"금지 패턴(`-preview`, sunset 세대) 검사"**로: 모델 id는
  perishable이라 정답을 핀하면 세대 교체마다 테스트가 깨진다. 클래스 가드가 brittleness 없이 버그 클래스를 막는다.

## 외부 공유 OK
- 패턴: 멀티-프로바이더 라우팅에서 "한 모델만 실패" → 분기 비대칭/fall-through 의심.
- 패턴: 프리뷰 모델 alias를 코드에 고정하지 말 것(GA 전환 시 폐기).
- 패턴: perishable 식별자 회귀 테스트는 "정답 핀"이 아닌 "금지 패턴" 검사로.
- 일반화 교훈: 외부 의존성(모델/엔드포인트) 수명주기를 CI 가드로 감시.

## redaction 기록 (일반화 — 실명/구조 미기재)
- 인시던트(특정 경로 404, 프로덕션 채팅): 사용자 승인 + remediation 머지 완료 → 공개. 예방 교훈 중심.
- **모델 라인업**: 깨진 사례는 Gemini로 명시(프리뷰→GA 폐기는 공개 사실). **나머지 프로바이더는 "다른 프로바이더들"로 일반화**(전체 유료 라인업/티어 매핑은 비즈니스 시그널). 코드 스니펫은 provider 일반 이름으로.
- **구체 모델 버전 숫자**: 글에 박지 않음 — `-preview` suffix / sunset 세대 같은 *패턴*으로만 표현(회귀 가드 코드도 패턴 검사).
- 미들웨어 클래스명·모델 선택 내부 구조: 일반화("런타임 모델 선택 미들웨어").
- PR 번호: "후속 PR로 닫음"으로 일반화. 자격증명 값 없음(확인).
