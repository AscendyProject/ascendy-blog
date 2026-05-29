---
title: "GPU 한 장이면 되겠지 — 자체 AI 추론 서빙 삽질기 1부"
description: "이미지 전처리 추론을 외부 멀티모달 API에서 자체 GPU 서빙으로 옮겼다가, 단일 GPU OOM → CPU offload 지연 → GPU 2장 분리 → managed GPU 후퇴까지 간 기록. 데모 규모에서 잘 되던 게 프로덕션 배치에서 무너지는 이유와 self-hosting GPU 추론의 숨은 비용."
pubDate: 2026-05-30
author: "Ascendy Engineering"
tags: ["gpu", "inference", "triton", "vllm", "cost-optimization", "oom", "self-hosting", "war-story"]
category: "infra"
lang: "ko"
translationKey: "ai-serving-evolution-part1"
sourceIntake:
  - "docs/intake/from-infra/2026-05-28-ai-serving-evolution-part1.md"
draft: true
redactionReviewed: false
---

## TL;DR

- 이미지 전처리 AI(묘사·태깅·얼굴 인식·임베딩)를 **외부 멀티모달 API → 자체 GPU 서빙 → managed GPU**로 옮기며 네 단계를 거쳤다.
- 각 단계는 **직전 단계의 해결책이 만든 새 문제**였다: API가 배치에서 무너짐 → 단일 GPU에 다 올렸더니 OOM → 임베딩을 CPU로 내렸더니 throughput 붕괴 → GPU를 2장으로 늘렸더니 vLLM OOM + 고정비용.
- 핵심 교훈 둘: ① **클라우드 LLM API의 단위 경제는 데모 규모와 프로덕션 규모에서 완전히 다른 함수다.** ② **self-hosting GPU 추론의 손익분기에는 숨은 비용이 있다** — OOM 튜닝 엔지니어링 시간 + always-on 고정비용 + 운영 복잡도.

> **소스 노트.** 이 글의 timeline은 운영 기억과 콘솔 히스토리가 1차 소스다. 중간 단계(단일 GPU → CPU offload → GPU 2장)는 여러 변경이 한 커밋으로 압축돼 git에 깔끔히 남지 않았다. 코드가 증명하는 부분과 기억에 기댄 부분을 본문에서 구분해 표시했다.

## 배경 — 1~2장에서 잘 되던 것

이미지를 업로드하면 AI가 전처리하는 기능을 만들었다. 사진 한 장에 대해 묘사를 생성하고, 태그를 붙이고, 얼굴을 인식하고, 검색용 임베딩을 뽑는다. 첫 구현은 가장 빠른 길로 갔다 — **외부 멀티모달 LLM API**를 호출해 사진을 묘사하게 했다. 사진 1~2장으로 테스트하니 빠르고 정확했다. 끝난 줄 알았다.

문제는 우리 서비스가 본질적으로 **앨범 단위**라는 데 있었다. 사용자는 사진을 한 장씩 올리지 않는다. 100장을 한 번에 올린다.

## 1단계 — 클라우드 API가 배치 규모에서 무너졌다

사진이 100장 단위가 되자 두 가지가 동시에 터졌다: **지연과 비용**. per-call 과금과 per-call 지연이 배치 크기에 선형으로 쌓인다. 1~2장에서 무해하던 상수가 100장에서는 서비스 성립 자체를 위협하는 크기가 됐다.

이건 튜닝으로 풀 문제가 아니었다. "이미지 한 장당 외부 API를 한 번 호출한다"는 **구조 자체**가 배치 워크로드와 맞지 않았다. 최적화가 아니라 구조 교체가 필요했다.

> **교훈 1.** 클라우드 LLM API의 단위 경제는 데모 규모와 프로덕션 규모에서 다른 함수다. 1~2장에서의 "잘 됨"은 100장에서의 "성립함"을 전혀 예측하지 못한다. per-call 비용·지연이 곱해지는 워크로드라면, 데모의 성공은 거짓 신호일 수 있다.

그래서 추론을 우리 쪽으로 가져오기로 했다. 자체 GPU 서빙.

## 2단계 — 단일 GPU에 다 올렸더니 OOM

방향을 자체 서빙으로 틀고, **상위 GPU 한 장** 위에 [Triton Inference Server](https://github.com/triton-inference-server/server)로 전 모델을 올렸다. 모델 스택은 다섯 종류였다:

- 텍스트 임베딩 모델(다국어)
- reranker
- 비전 인코더(image–text 정렬)
- 얼굴 검출기 + 얼굴 임베딩(2단 파이프라인)
- VLM(vision-language instruction 모델)

전부 한 장에 올리자 **OOM이 계속 났다.** 범인은 명확했다. VLM이 VRAM의 대부분을 먹는데, 그 위에 임베딩 모델들까지 상주시키니 메모리가 맞지 않았다.

완화 시도는 직관적이었다 — **임베딩과 reranker를 GPU에서 CPU로 내렸다.** 이 둘은 VLM보다 작고 CPU에서도 돌아가긴 한다. VRAM 압박을 풀려고 가장 가벼운 모델들을 CPU로 옮긴 것이다.

> **소스 노트(기억 기반).** 이 CPU offload 단계는 현재 코드가 증명하지 못한다. CPU로 내렸던 모델들은 이후 아키텍처를 또 바꾸면서 모델 레포에서 제거됐고, 지금 남은 모델 설정은 전부 GPU 서빙이다. 즉 이 단계는 커밋 압축과 이후 모델 제거로 git에 남지 않은, 기억에 기댄 서술이다.

Triton에서 모델을 CPU로 내린다는 건 `instance_group`의 `kind`를 바꾸는 것이다:

```text
# GPU OOM을 피하려 임베딩 모델을 CPU로 내릴 때.
# VRAM은 풀리지만 throughput으로 값을 치른다.
instance_group { kind: KIND_CPU, count: N }   # GPU 서빙이면 kind: KIND_GPU

# (예시 — 현재 우리 모델 레포에는 KIND_CPU 항목이 없다. CPU로 내렸던
#  모델들은 이후 제거됐다. 위는 "GPU→CPU offload 시 설정이 어떻게 보이는가"의
#  일반 예시일 뿐이다.)
```

## 3단계 — CPU offload가 이번엔 지연을 만들었다

메모리는 풀렸다. 그런데 임베딩이 너무 느려졌다.

임베딩 워크로드의 핵심은 **batch throughput**이다. 100장 앨범에서 수백 개의 벡터를 한꺼번에 뽑아야 한다. 이걸 CPU로 내리니 처리량이 무너졌다. 메모리 문제를 지연 문제로 바꿔놓은 셈이다.

> **교훈 2.** CPU offload는 VRAM을 사주지만 throughput으로 값을 치른다. 작은 모델이라도 처리량이 핵심인 워크로드(임베딩처럼 배치로 도는 것)를 CPU로 내리면, OOM을 지연으로 옮길 뿐 문제가 사라지지 않는다.

그래서 GPU를 늘렸다. 상위 GPU 한 장 대신 **중급 GPU 2장** 구성으로:

- **GPU A** — Triton으로 VLM을 제외한 모델들(임베딩 다시 GPU로, 얼굴 파이프라인, 비전 인코더)
- **GPU B** — VLM을 [vLLM](https://docs.vllm.ai/)으로 분리 서빙

VLM만 따로 vLLM으로 뺀 이유는, Triton의 generic Python backend보다 vLLM이 LLM/VLM 추론에 특화된 메모리·배칭 관리(paged attention, continuous batching)를 해주기 때문이다. generic 멀티모델 서버 한 대로 임베딩부터 생성형 VLM까지 다 감당하려는 것 자체가 무리였다.

## 4단계 — vLLM도 OOM, 그리고 고정비용

분리했는데 vLLM 쪽에서 **또 OOM과 불안정이 반복됐다.** VLM은 추론 중 KV 캐시가 컨텍스트 길이와 동시 시퀀스 수에 따라 커진다. 메모리 노브를 계속 조여야 했다.

```bash
# VLM을 vLLM으로 분리 서빙할 때의 OOM 방어 튜닝.
# 처음엔 공격적(높은 점유율·긴 컨텍스트)으로 잡았다가
# OOM 때문에 보수적으로 내린 흔적이 노브 값에 남는다.
# (아래는 placeholder — 실제 값보다 방향이 핵심이다: 공격적 → 보수적.)
python3 -m vllm.entrypoints.openai.api_server \
    --model <model-path> \
    --gpu-memory-utilization <high→lower> \   # 점유율을 내려 OOM 여유 확보
    --max-model-len <long→shorter> \          # 컨텍스트를 줄여 KV 캐시 상한 하향
    --dtype bfloat16 \
    --max-num-seqs <seq-limit> \              # 동시 시퀀스 제한 (backpressure)
    --enable-chunked-prefill                  # 긴 prefill을 쪼개 메모리 단편화 방어
```

> **코드 흔적.** 지금은 parked된 vLLM 설정에 이 튜닝의 흔적이 그대로 남아 있다. `--gpu-memory-utilization`과 `--max-model-len`이 스크립트 기본값(공격적)과 override(보수적) 사이에서 갈라져 있다 — 처음엔 공격적으로 잡았다가 OOM 때문에 보수적으로 내린 자국이다.

그리고 여기에 **고정비용**이 얹혔다. 자체 클러스터의 GPU 노드는 always-on이다. 트래픽이 없는 새벽에도 GPU 2장이 시간당 과금된다. multi-model 서빙의 운영 부담 — OOM 튜닝, 모델 로딩, 노드 장애 대응 — 에 always-on 고정비용까지 더해지자, "자체 서빙이 클라우드 API보다 싸다"는 처음의 가정이 흔들렸다.

## 결정 / 트레이드오프

데모에서 "GPU 한 장이면 되겠지"로 시작한 게 GPU 2장 + vLLM 분리 + 끝없는 메모리 튜닝으로 번졌다. 그 시점에 **managed GPU로의 후퇴**를 결정했다. (이 이주 이야기가 2부다.)

여기서 정직하게 짚을 것은, self-hosting GPU 추론의 손익분기가 흔히 말하는 "API per-call 비용 vs GPU 시간당 비용"의 단순 비교가 아니라는 점이다. 그 등식에는 세 가지 숨은 비용이 빠져 있다:

1. **OOM 튜닝에 드는 엔지니어링 시간** — 메모리 노브를 맞추고, CPU/GPU 배치를 바꾸고, 모델을 쪼개는 데 든 사람 시간.
2. **always-on 고정비용** — 트래픽과 무관하게 GPU 노드가 시간당 과금된다. 부하가 들쭉날쭉한 서비스에서 이 비용은 크다.
3. **운영 복잡도** — multi-model 서빙은 한 모델이 죽으면 다른 모델도 같이 영향받고, 노드 장애 대응 표면이 넓다.

이 셋을 등식에 넣으면, 우리 규모와 트래픽 패턴에서는 managed GPU가 더 나은 선택이었다. self-hosting이 항상 틀렸다는 게 아니다 — **손익분기를 계산할 때 시간당 단가만 보면 틀린 답이 나온다**는 것이다.

## 후속

- **2부**: managed GPU 이주 — 무엇이 단순해졌고, 무엇을 포기했는가.
- 참고: [vLLM engine args](https://docs.vllm.ai/en/latest/models/engine_args.html), [vLLM chunked prefill](https://docs.vllm.ai/en/latest/performance/optimization.html), [Triton `instance_group`](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/model_configuration.md#instance-groups).

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
