---
team: infra
date: 2026-05-30
topic: "managed GPU 이주 후에도 pod 2개 상시 가동으로 고정비용이 새던 것을, 워크로드를 latency budget으로 갈라 잡은 비용 설계. 검색 경로(임베딩)는 상시 pod, 비동기 경로(이미지 캡션)는 serverless, 얼굴 모델은 VRAM 여유에 무료 탑승. 콜드스타트를 사용자 체감 경로 밖으로 치환한 사고법. 삽질기 2부."
suggestedCategory: infra
suggestedTags: ["gpu", "inference", "serverless", "triton", "vllm", "cost-optimization", "latency-budget", "war-story"]
redactionNote: "원본(infra private repo)의 내부 식별자(클라우드/managed GPU/serverless vendor명, GPU SKU, 레지스트리/버킷/namespace, 얼굴 검출·인식 모델명[개별이라도], 임베딩·캡션 모델 전체 조합)는 일반화 후 게재. 구체 비용 숫자·트래픽 규모·스케일 임계 수량은 원본에서부터 배제 — 복원 금지. raw는 비공개 repo에만 존재."
---

# (정제본) managed GPU 이후의 비용 설계 — pod vs serverless를 latency로 가르기 (2부)

> 이 파일은 infra 팀 raw 인테이크를 redaction한 **정제본**이다. raw 원본은 infra
> private repo의 `docs/blog-intake/`에 있다. 포스트의 `sourceIntake`가 이 파일을 가리킨다.
>
> **소스 노트**: timeline은 운영자 1차 기억이 1차 소스. 코드는 현재 서빙 구조를
> 증명하되, config 파일이 남아 있어도 *현재 실제로 서빙하는* 모델만 담았다
> (파일 존재 ≠ 현재 사용 — 1부에서 데었던 함정).

## 무엇을

managed GPU로 옮겼지만 처음엔 **serverless를 몰라 pod 2개를 상시 가동** → 트래픽
없어도 GPU pod가 24/7 돌아 고정비용이 **수백 달러 규모**로 샜다. serverless GPU를
알게 된 뒤 워크로드를 latency 특성으로 둘로 갈랐다:

- **상시 pod(24/7) — Triton(TensorRT)**: 임베딩(벡터검색 직결 → 상시), 얼굴 모델
  (VRAM 여유에 무료 탑승).
- **serverless — vLLM**: 이미지 캡션(즉시성 불필요 → 콜드스타트 감수, on-demand).

이렇게 바꾸자 비용이 획기적으로 줄었다.

## 왜

핵심 기준은 **"이 작업에 허용되는 지연(latency budget)이 얼마인가"**:

- 임베딩 → 검색 대기 경로라 콜드스타트 불가 → 상시 pod(양보 불가).
- 얼굴 모델 → 임베딩 때문에 어차피 떠 있는 pod의 남는 VRAM에 얹어 추가비용 0 (TRT 컴파일).
- 이미지 캡션 → 비동기라 수십 초 지연 허용 → serverless, 트래픽 없을 땐 과금 0.

**교훈: 비용 최적화의 첫 질문은 "더 싼 GPU에 올릴까"가 아니라 "이 작업이
콜드스타트를 견디는가"다.** latency budget이 큰 작업을 serverless로 빼는 것만으로
상시 pod 한 대를 통째로 없앴다.

스케일: 저트래픽엔 serverless 0과금, 대량 유입(일정 임계 수량 이상)엔 고성능 GPU로
batch size를 키워 GPU-시간당 비용을 낮춤 — 양극단을 한 구조로 커버.

## 공개 가능 (게재 OK)

- latency budget으로 워크로드를 pod/serverless로 가르는 의사결정 프레임.
- 검색 경로(임베딩)=상시, 비동기 경로(캡션)=serverless 분배 논리.
- VRAM 여유에 부가 워크로드(얼굴 모델) 무료 탑승 → 추가비용 0 패턴.
- 콜드스타트를 "사용자 체감 경로 밖이면 사실상 공짜"로 환산해 수용하는 사고법.
- 저트래픽(serverless 0과금) ↔ 대량 유입(고성능 GPU batch) 양극단 스케일 설계.
- "옵션(serverless)을 몰라 상시 pod만 띄워 고정비용에 데였다"는 흔한 함정.

## redaction 적용 (원본 → 일반화)

- 구체 비용 숫자(월 고정비/절감폭/시간당 단가) → **복원 금지**, "수백 달러 규모" 정성표현까지만.
- 현재 트래픽/유저 규모 → "트래픽이 낮은 단계"까지만.
- 스케일 임계 수량(대량 batch 전환 사진 장수) → "일정 임계 수량 이상".
- GPU 인스턴스 타입/SKU → "managed GPU", "고성능 GPU".
- 클라우드/managed GPU/serverless vendor명 → "managed GPU 서비스", "serverless GPU".
- **얼굴 검출·인식 모델명 → 개별이라도 redact** (프라이버시·제품 민감). 본문은 "얼굴 모델"만.
- 임베딩·캡션 모델명 → 일반 카테고리("임베딩 모델", "캡션 모델"). 전체 파이프라인 조합 나열 지양.
- registry/버킷/namespace → 본문 미등장, 스니펫 추가 시 일반화.
- (Triton/vLLM/TensorRT는 public 기술명이라 유지 — 1부와 동일 기준.)

## Class 검토 (인테이크 동봉)

- Class A: 이 비용 설계는 **현재 운영 중인 안착된 구조**. 보안 로직·미해결 약점 없음
  (Class A 해당 없음) → publish 안전. (1부의 "2부 예고"에 대한 후속, 이주는 이미 production.)
- Class B: credential 값 부재.
- Class C(위 redaction): 비용숫자/트래픽/임계수량/SKU/vendor/얼굴모델명 일반화 완료.

## 외부 인용 링크 (공개)

- vLLM: https://docs.vllm.ai/en/latest/
- Triton + TensorRT: https://github.com/triton-inference-server/server
