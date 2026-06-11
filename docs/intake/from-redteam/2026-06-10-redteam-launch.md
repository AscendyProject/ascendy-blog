---
team: redteam
date: 2026-06-10
topic: "오픈소스 적대적 에이전트-페어 하네스 redteam v0.1.0 런칭 — 한 모델이 test-first로 코드를 쓰고, 다른 독립 모델이 diff를 적대적으로 리뷰, 사람은 비가역 단계만 게이트. 리드 차별점=티어드 리뷰(blocker/major/minor)+에스컬레이션 사다리(retry→rescue→human)."
suggestedCategory: "meta"
suggestedTags: ["ai-collaboration", "adversarial-review", "open-source", "developer-tools", "agent-harness"]
redactionReviewed: true
---

> redteam 팀의 cross-repo 런칭 요청 기반 정제본. **canonical 소스는 공개 repo**
> (github.com/AscendyProject/redteam, Apache-2.0, v0.1.0)이고, 사실은 발행 시점에 **repo README + v0.1.0
> release note를 직접 fetch해 확인**(요청서가 "README 베껴쓰지 말고 repo에서 canonical을 끌어오라"고
> 명시) + **redteam 팀 엔진 대조 fact-check 반영**(에스컬레이션 마지막 칸·리뷰어 입력 범위 정밀화).
> (라이선스만은 *발행 후* AGPLv3→Apache-2.0 재라이선스로 별도 정정 — 아래 "외부에 공유하면 안 되는 부분" :47 참조.)
> **Class A 없음**(공개 OSS 런칭). **Class B 없음.** 사내 정보는 공개 수준만("내부 모노레포에서
> 추출, 실제 머지된 PR을 구동, Nuxt/Vue/TS 프론트에서 cross-stack 검증") — 어떤 PR/코드인지 등 내부
> 세부는 적지 않는다. 매핑은 여기 적지 않는다.

## 무엇 (canonical, README에서 확인)

**redteam** = 코드를 AI로 출시하기 위한 **적대적 에이전트-페어 하네스**(오픈소스). 한 줄 정의:
"한 모델이 test-first 파이프라인(plan → test → implement)으로 작업을 몰고, **다른** 모델이 그
작업을 적대적으로 리뷰하고, 사람이 비가역 단계를 게이트한다."

베팅: **두 독립 모델 관점의 충돌이, 한 모델이 자기 작업에 혼자 고무도장 찍는 걸 잡는다.**

## 차별점 (README "How it's different" / "When to use it")

1. **티어드 리뷰 + 에스컬레이션 사다리** ⭐ (리드). 리뷰가 pass/fail이 아니다. 리뷰어가 각 발견에
   **severity(blocker/major/minor)**를 매기고, 오케스트레이터가 그걸 **라운드를 가로질러 추적**한다.
   여러 라운드를 살아남은 blocker는 사다리를 오른다: **worker 재시도 → 더 무거운 `rescue` 패스 →
   사람이 rescue 결과를 게이트**(복구 불가 시 운영자에게 보류). 한 번의 거절이 런을 죽이지 않고,
   고집스런 진짜 버그가 한 번의 재시도로 슬쩍 통과하지 못한다. (이와 별개로, *plan* 단계에서 막히면
   하네스가 멈추고 운영자에게 직접 묻는 탈출구도 있다.)
2. **리뷰어는 작성자에 대해 눈먼다.** 신선한 에이전트 + 설정상 *다른* 모델이 **변경(diff)과
   태스크 명세·보안 체크리스트**를 보고, **구현자의 추론은 보지 않는다**(작성자의 사고 과정에 눈멈).
3. **위험에 맞춰 노력을 조절(scale effort to risk).** redteam은 *헤비웨이트 경로* — 사소한 오타가
   아니라 **guarded(auth·storage·concurrency·public API)·전략/아키텍처** 변경용. 두 레버(역할별 모델,
   에스컬레이션 사다리)가 노력을 위험에 맞춘다. **자동 tier-routing은 로드맵(#13)이지 이번 릴리스에
   없음 — 정직하게.**
4. **모델 자유.** worker·reviewer 어느 쪽에든 Claude 또는 Codex(`.redteam/config.toml [models]`
   역할별 바인딩). "루틴엔 싼 구현자, guarded엔 프런티어 리뷰어" 식.
5. **런타임 의존성 0**(stdlib-only, project-agnostic), 벤더드 설치, Claude Code 플러그인.

## 상태/정직성 (README "Status")
- **early, v0.1.0**(2026-06 첫 독립 릴리스). "내부 모노레포에서 추출 — 거기서 실제 머지된 PR을
  구동했다. API·레이아웃은 아직 움직일 수 있다." Nuxt/Vue/TS 프론트에서 cross-stack 검증(release note).
- **Apache-2.0**, 기여는 CLA(provenance 유지 + 다른 조건 제공 옵션 보존). (출시 시 AGPLv3 → 이후 Apache-2.0로 재라이선스, 2026-06-12 반영.)

## 설치 CTA (README)
```
# Claude Code 플러그인 (권장)
/plugin marketplace add AscendyProject/redteam
/plugin install redteam@ascendy-redteam
/redteam:redteam-install

# 또는 어떤 스택이든 직접 벤더
python3 .redteam/scripts/install.py /path/to/your/project
```

## 외부에 공유해도 좋은 부분
- redteam의 정의·차별점·설치·상태(전부 공개 repo README 기반).
- 리드 앵글: "두 번째 모델이 '괜찮아 보여요' 하면 끝? — 티어드 리뷰 + 에스컬레이션 사다리".
- 우리 기존 적대적 리뷰 메타글(headless-adversarial / right-answer-wrong-reasoning /
  agent-os-dogfooding)과 연결 — 이 글들에서 다룬 패턴이 OSS 도구로 추출된 것.

## 외부에 공유하면 안 되는 부분 (redaction 시 참고)
- 내부 모노레포의 어떤 PR/코드를 구동했는지 등 내부 세부 → "실제 머지된 PR 구동" 수준만.
- **자동 tier-routing이 이미 있다고 쓰지 말 것**(로드맵 #13). v0.1.0 early임을 명시.
- 발행 전 redteam 팀에 기술 사실 fact-check 요청 가능(요청서가 제안함).
