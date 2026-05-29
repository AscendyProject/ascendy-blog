---
team: infra
date: 2026-05-28
topic: "AI 이미지 전처리 추론 스택을 외부 멀티모달 API → 자체 GPU 서빙으로 옮겼다가, 단일 GPU multi-model OOM → CPU offload 지연 → GPU 2장 분리 → managed GPU 후퇴까지 간 삽질기 1부. '1-2장 데모에서 잘 되던 게 100장 배치에서 무너진다'의 구체 사례와 self-hosting GPU 추론의 숨은 비용."
suggestedCategory: infra
suggestedTags: ["gpu", "inference", "triton", "vllm", "cost-optimization", "oom", "self-hosting", "war-story"]
redactionNote: "원본(infra private repo)의 내부 식별자(클라우드/GPU vendor명, GPU SKU, 컨테이너 레지스트리 경로, 클러스터/namespace/image tag, object storage 버킷명, 모델 레포 파일명, vLLM 튜닝 실값)는 일반화 후 게재. 구체 비용 숫자는 원본에서부터 의도적으로 배제 — 복원 금지. raw는 비공개 repo에만 존재."
---

# (정제본) 클라우드 API → 자체 GPU 서빙 → managed GPU — AI 전처리 삽질기 1부

> 이 파일은 infra 팀의 raw 인테이크를 redaction한 **정제본**이다. raw 원본은
> infra private repo의 `docs/blog-intake/`에 있다. 포스트의 `sourceIntake`가
> 이 파일을 가리킨다.
>
> **소스 노트**: 이 글의 timeline은 운영자의 1차 기억 + 클라우드 콘솔
> 히스토리가 1차 소스다. 중간 삽질 단계(단일 GPU → CPU offload → GPU 2장)는
> 여러 단계가 한 commit으로 압축돼 git에 남지 않았고, 일부는 기억-기반
> 서술이다. 코드가 증명하는 부분과 기억에만 있는 부분을 본문에서 구분한다.

## 무엇을

이미지 업로드 시 AI가 전처리(묘사 생성·태깅·얼굴 인식·임베딩)하는 기능을
만들었고, 구현이 네 단계를 거쳤다:

1. **외부 멀티모달 LLM API로 사진 묘사.** 1-2장 데모는 빠르고 잘 됐다.
2. **자체 서빙 1차 — 상위 단일 GPU + Triton으로 전 모델.** 텍스트 임베딩,
   reranker, 비전 인코더, 얼굴 검출+임베딩, VLM을 한 장에 전부.
3. **자체 서빙 2차 — 중급 GPU 2장 분리.** 한 장은 Triton(VLM 제외), 다른
   한 장은 VLM을 vLLM으로.
4. **managed GPU로 이주.** 고정비용 + 운영 복잡도 때문에 자체 GPU 노드를
   접고 managed GPU 서비스로.

이 글(1부)은 1→4 삽질을 다룬다. 4 이후는 2부.

## 왜 — 단계마다 무너진 지점

- **1단계:** 1-2장 데모는 함정. 100장 배치에서 per-call 과금·지연이 선형으로
  쌓여 서비스 성립을 위협 → "외부 API per-image 호출" 구조 자체를 버림.
  교훈: 클라우드 LLM API의 단위 경제는 데모 규모와 프로덕션 규모에서 다른 함수.
- **2단계:** 상위 단일 GPU에 multi-model → OOM. VLM이 VRAM 대부분을 먹는데
  임베딩 모델까지 상주 → 메모리 부족. 완화로 임베딩/reranker를 CPU offload.
- **3단계:** CPU offload가 이번엔 throughput을 무너뜨림 → 메모리 문제를 지연
  문제로 바꾼 셈. 그래서 중급 GPU 2장으로(임베딩 GPU 복귀 + VLM은 vLLM 분리).
- **4단계:** vLLM도 OOM 반복 → 메모리 노브 보수적으로 조임(점유율↓, 컨텍스트↓,
  동시 시퀀스 제한, chunked prefill). 거기에 always-on 고정비용까지 → "자체
  서빙이 API보다 싸다" 가정이 흔들려 managed GPU로 후퇴.

**1부 결론:** self-hosting GPU 추론의 손익분기는 "API per-call vs GPU 시간당"
단순 비교가 아니다. OOM 튜닝 엔지니어링 시간 + always-on 고정비용 + 운영
복잡도가 숨은 비용으로 붙는다. 각 단계가 *직전 단계 해결책이 만든 새 문제*라는
구조가 핵심.

## 공개 가능 (게재 OK)

- 클라우드 LLM API의 단위 경제가 데모(1-2장) vs 프로덕션(100장 batch)에서 다른 함수.
- 단일 GPU multi-model에서 VLM이 VRAM을 지배해 임베딩이 OOM을 유발하는 패턴.
- CPU offload의 trade-off — VRAM은 사지만 throughput으로 값을 치른다.
- Triton(generic 멀티모델) + vLLM(LLM/VLM 특화) 분리 서빙의 동기·복잡도.
- vLLM OOM 방어 튜닝의 일반 노브: gpu memory utilization, max model len,
  max num seqs, chunked prefill.
- self-hosting GPU 추론의 숨은 비용 = OOM 튜닝 시간 + always-on 고정비용 + 운영 복잡도.
- "작은 테스트에서 잘 되던 게 규모에서 무너진다"의 구체적 4단계 사례.

## redaction 적용 (원본 → 일반화)

- 클라우드/관리형 쿠버네티스 vendor명, managed GPU 서비스명 → "클러스터 GPU 노드를 제공하는
  클라우드", "managed GPU 서비스"
- 초기 외부 멀티모달 API vendor명 → "외부 멀티모달 LLM API"
- GPU 인스턴스 타입/SKU → "상위 단일 GPU → 중급 GPU 2장 → managed 중급 GPU"
- 구체 비용 숫자 → **추가 금지** (원본에서부터 배제, 정성적 "비용 압박"만)
- 컨테이너 레지스트리 경로 / 클러스터명 / namespace / image tag / object storage 버킷명 → 본문 미등장, 스니펫 추가 시 일반화
- 모델 레포 디렉토리/파일명(예: TensorRT plan 파일명) → "모델 레포 디렉토리", "TensorRT plan 파일"
- vLLM 런타임 튜닝 실값(`--gpu-memory-utilization`, `--max-model-len`,
  `--max-num-seqs`) → placeholder(`<high>`/`<lower>` 등). 방향(공격적→보수적)만 의미.
- 모델명: 오픈소스라 redact 대상은 아니나 본문은 일반 카테고리("텍스트 임베딩
  모델", "VLM")로 서술 — 정확한 모델 조합이 제품 전처리 파이프라인을 노출하는
  약한 제품 정보라서. 조합 전체 나열은 지양.

## Class 검토 (인테이크 동봉)

- Class A: 삽질의 결말(managed GPU 이주)은 이미 production = remediated. 미해결
  운영 약점 아님. → publish 안전.
- Class B: credential 값 부재.
- Class C(위 redaction): vendor/SKU/레지스트리/버킷/모델레포/튜닝실값 일반화 완료.

## 외부 인용 링크 (공개)

- vLLM engine args: https://docs.vllm.ai/en/latest/models/engine_args.html
- vLLM chunked prefill: https://docs.vllm.ai/en/latest/performance/optimization.html
- Triton `instance_group` (KIND_CPU/KIND_GPU): https://github.com/triton-inference-server/server/blob/main/docs/user_guide/model_configuration.md#instance-groups
