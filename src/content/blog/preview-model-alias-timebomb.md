---
title: "한 모델만 404가 났다 — 프리뷰 alias 시한폭탄과 분기 비대칭"
description: "멀티 프로바이더 에이전트 채팅에서 한 모델 경로만 항상 404가 났다. 원인은 두 겹 — 그 경로만 명시 매핑 없이 base 모델로 fall-through했고, 그 base가 GA 전환 후 폐기된 프리뷰 alias였다. 모델 수명주기를 CI 가드로 막은 기록."
pubDate: 2026-05-31
author: "Ascendy Engineering"
tags: ["llm", "model-lifecycle", "regression-testing", "incident-prevention", "multi-provider"]
category: "backend"
lang: "ko"
translationKey: "preview-model-alias-timebomb"
sourceIntake:
  - "docs/intake/from-backend/2026-05-28-preview-model-alias-timebomb.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 멀티 프로바이더 에이전트 채팅에서 **한 모델 경로만 항상 404**가 났다. 나머지 모델은 멀쩡했다.
- 원인은 한 개가 아니라 **두 겹**이었다: ① 분기 비대칭 — 그 경로만 명시 매핑 없이 에이전트의 **base 모델**로 fall-through ② 그 base가 **프리뷰 alias**였고, 프로바이더가 GA 전환 후 그 alias를 폐기하면서 404가 났다.
- 교훈 셋: 프리뷰 모델 id를 코드에 박지 마라 / "한 모델만 깨지면" 분기 비대칭을 의심하라 / 회귀 테스트는 "정답 핀"이 아니라 "금지 패턴"으로 짜라.

## 배경 — 왜 하나만 죽나

여러 LLM 프로바이더를 골라 쓰는 에이전트 채팅이 있었다. 그런데 특정 모델을 고르면 **항상 404**가 났고, 다른 프로바이더들은 정상이었다.

"**한 모델만 실패**"는 그 자체가 강한 단서다. 공통 경로(인증, 네트워크, 요청 포맷)가 문제면 보통 전부 깨진다. 하나만 깨졌다는 건 그 모델이 **다른 분기**를 타고 있다는 뜻이다.

## 원인 1 — 분기 비대칭 (fall-through)

런타임 모델 선택 미들웨어가, 일부 프로바이더에 대해서만 명시적으로 클라이언트를 매핑하고 있었다. 문제의 프로바이더에는 매핑이 없어 `None`을 반환했고, 그러면 override 없이 에이전트의 **base 모델**로 그대로 fall through했다.

```python
# 분기 비대칭: 일부 프로바이더만 명시 매핑, 나머지는 None → base 모델로 fall through
def _resolve_client(model_name: str):
    if model_name in PROVIDER_A_ALIASES:
        return client_a
    if model_name in PROVIDER_B_ALIASES:
        return client_b
    if model_name in PROVIDER_C_ALIASES:
        return client_c
    return None  # 매핑 없는 프로바이더 → None → 에이전트 base 모델로 fall through
```

다른 프로바이더들은 명시 매핑이라 자기 클라이언트로 안전하게 갔다. 매핑이 빠진 하나만 base 모델 id에 직접 노출됐다 — 그리고 그 base id가 문제였다.

## 원인 2 — base가 프리뷰 alias였다

fall-through가 도달한 base 모델 id가 **프리뷰 alias**로 고정돼 있었다. 프리뷰 alias는 deprecation 공지 후 정해진 일정에 따라 shutdown될 수 있다. shutdown되면 그 id로의 호출은 `404 NOT_FOUND`("no longer available")가 된다.

우리 경우 그 fall-through 경로의 프로바이더가 **Gemini**였다. 프리뷰 모델이 GA로 승격되면서 기존 프리뷰 alias가 사라졌고([모델 수명주기는 공개 문서로 확인된다](https://ai.google.dev/gemini-api/docs/models)), 그 한 경로만 404로 죽은 것이다. 코드에 박아둔 프리뷰 id가 **시한폭탄**이었던 셈이다.

## 수정 — GA id + 회귀 가드

즉각 수정은 base를 GA id로 교체하는 한 줄이었다. 거기에 전 코드베이스를 훑어 **곧 sunset될 세대**의 모델도 같이 교체했다.

핵심은 그다음에 넣은 **회귀 가드**다. "지금 정답인 모델 id"를 핀하지 않았다 — 그 id 자체도 언젠가 폐기되므로, 정답을 박으면 세대 교체마다 테스트가 깨진다(brittle). 대신 **금지 패턴**을 검사했다.

```python
# 회귀 가드: 정답 id를 핀하지 말고, 폐기/프리뷰 패턴만 금지
for client in configured_model_clients:
    mid = model_id(client)
    assert "preview" not in mid        # deprecate/shutdown될 수 있는 프리뷰 alias 금지
    assert SUNSET_GENERATION not in mid  # 곧 폐기될 세대 금지
```

모델 id는 본질적으로 perishable(언젠가 만료된다)하다. 이 가드가 만료될 id *전체*를 잡지는 못한다 — **알려진 위험 패턴**(프리뷰 alias, 특정 sunset 세대)을 막아 프로바이더의 lifecycle 모니터링을 보완하는 장치다. 다만 "다음 세대로 올릴 때마다 깨지는" brittleness 없이 그 패턴을 막는다는 점이, 정답 id를 핀하는 것보다 낫다.

## 다음에 같은 함정에 빠지지 않으려면

- **프리뷰 모델 alias를 코드에 박지 마라.** deprecate·shutdown될 수 있다. 가능하면 GA id를, 안 되면 프로바이더 수명주기 일정을 추적하거나 만료 가드를 둬라.
- **"한 모델만 깨지면"** 공통 경로가 아니라 **분기 비대칭/fall-through**를 의심하라.
- **외부 의존성(모델·엔드포인트)의 수명주기를 CI 가드로 감시하되**, "정답 핀"이 아니라 "금지 패턴(`-preview`, sunset 세대)"으로 — perishable 식별자에 맞는 저-brittleness 가드.

## 후속

- 모델 id뿐 아니라, 외부에서 수명주기가 바뀌는 다른 식별자(엔드포인트 버전, deprecated 파라미터)에도 같은 "금지 패턴" 가드를 확장.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
