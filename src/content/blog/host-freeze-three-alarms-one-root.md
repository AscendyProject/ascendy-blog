---
title: "알람 3개, 근원은 하나 — 노드 host freeze가 분기한 인시던트"
description: "검색엔진 down, 메트릭 시계열 역행, 노드 readiness flapping — 도메인이 다른 알람 3개가 동시에 울렸다. 근원은 하나였다: 한 노드의 host freeze. 그리고 probe가 없어 '응답불가인데 1/1 Running'으로 보인 silent hang, drain했더니 갈 곳이 없어 전부 Pending된 단일 노드풀 함정까지."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["kubernetes", "elasticsearch", "observability", "incident", "root-cause-analysis", "health-probes"]
category: "infra"
lang: "ko"
translationKey: "host-freeze-three-alarms-one-root"
sourceIntake:
  - "docs/intake/from-infra/2026-05-29-host-freeze-three-alarms-one-root.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 도메인이 전혀 다른 알람 3개가 동시에 울렸다 — **검색엔진 down, 메트릭 시계열 역행(out-of-order), 노드 readiness flapping.** 근원은 하나였다: **한 노드의 host freeze.**
- host가 얼면 그 위 모든 게 동시에 멈춘다. 디스크 IO가 멈춰 검색엔진이 응답을 못 하고, CPU 스케줄링이 멈춰 노드가 NotReady↔Ready를 오가고, 메트릭이 몰려 나오며 timestamp가 역행한다.
- 숨은 함정 둘. ① **probe가 없으면 "응답불가"가 "정상"으로 보인다** — 프로세스가 살아있어 `1/1 Running`인데 실제로는 hang. ② **단일 역할 노드 풀을 drain하면 갈 곳이 없다** — `nodeSelector`가 그 노드만 가리키는데 그 노드가 한 대뿐이라, drain은 전부 Pending으로 만들었다.

> **소스 노트.** 이 글은 상위 인프라 팀의 인시던트 회고(`docs/intake/from-infra/2026-05-29-host-freeze-three-alarms-one-root.md`)를 정제한 것이다. 노드·클러스터·볼륨 이름, 내부 IP, vendor, 노드 토폴로지 등 내부 식별자는 일반화했다. 함정 2에서 드러난 "단일 노드 풀 SPOF"는 이후 노드 추가와 분산으로 고쳤는데, 그 과정에서 또 다른 배포 함정을 밟았다 — 그쪽 이야기는 [분산하라는 제약이 배포를 막았다](/blog/anti-affinity-deploy-order-trap/)에 있다.

## 알람 3개, 도메인 3개

모니터링으로 알람이 거의 동시에 셋 들어왔다.

1. `ElasticSearchDown` — 검색엔진이 죽었다
2. `PrometheusOutOfOrderTimestamps` — 메트릭 시계열의 timestamp가 역행한다
3. 어떤 노드의 readiness가 15분간 **6번** 바뀐다 (flapping)

처음엔 셋이 별개로 보였다. 검색엔진, 메트릭 수집, 노드 상태 — 도메인이 다 다르다. 각각 쫓아가면 세 갈래의 디버깅이 된다. 그런데 한 가지가 걸렸다. **셋 다 같은 시각에, 같은 노드 위에서 터졌다.**

## 근원은 하나였다 — host freeze

노드부터 봤다. 리소스 request는 정상 범위(CPU·메모리 과부하 아님)인데, 그 위의 pod들이 비정상적으로 자주 재시작하고 있었다. 검색엔진 로그를 직접 읽으니 결정적이었다 — **데이터 디스크 health check가 6분, 타이머 스레드가 40초 정지**해 있었다. 디스크 IO와 CPU 스케줄링이 동시에 멈추는 것, 바로 **host freeze**의 전형이다.

host(노드의 하이퍼바이저·하드웨어)가 간헐적으로 얼면, 그 위의 모든 게 한꺼번에 멈춘다. 그리고 그 하나의 멈춤이 세 갈래의 증상으로 갈라진다.

- **디스크 IO 멈춤** → 검색엔진이 데이터 디렉토리를 읽고 쓰지 못함 → 응답 지연 → 모니터링이 "down"으로 감지
- **CPU 스케줄링 멈춤** → 검색엔진 타이머 40초 정지, kubelet heartbeat 지연 → 노드가 NotReady↔Ready를 오감 (flapping)
- **kubelet/cadvisor가 멈췄다 살아나며** 메트릭을 몰아서 노출 → timestamp 역행 → Prometheus가 out-of-order로 거부

> **교훈 1 — 알람을 도메인별로 따로 쫓지 마라.** 검색엔진 down · 메트릭 깨짐 · 노드 flapping은 표면상 무관하지만, 같은 시각 같은 노드에서 터졌다면 공통 root(그 노드)를 먼저 의심하는 게 빠르다. "노드 → 그 위 워크로드" 순서로 봤더니, 그게 셋을 한 번에 설명했다.

## 함정 1 — probe가 없으면 "응답불가"가 "정상"으로 보인다

여기 함정이 하나 숨어 있었다. 검색엔진이 디스크 IO hang으로 사실상 응답불가였는데, `kubectl get pod`에는 멀쩡히 **`1/1 Running`**으로 떴다. 컨테이너 프로세스가 살아있었기 때문이다.

readiness/liveness probe가 없으면 쿠버네티스는 **"프로세스가 떠 있음 = 정상"**으로 본다. 실제로 요청을 처리하는지는 보지 않는다. 그래서 진단을 `kubectl` 상태가 아니라 **애플리케이션 로그를 직접 읽는** 방식으로만 할 수 있었다. probe가 있었다면 검색엔진이 자동으로 `NotReady`로 빠지면서 트래픽이 끊기고, 알람이 더 일찍 더 명확하게 떴을 것이다.

그래서 remediation으로 probe를 추가했다 — 다만 두 probe의 역할을 분리해서.

```yaml
# readiness: 응답성 체크. 실패하면 NotReady로 트래픽 차단 + 알람.
#            "프로세스 살아있음"이 아니라 "실제로 응답하는가"를 본다.
readinessProbe:
  httpGet: { path: /_cluster/health?local=true, port: 9200 }
  timeoutSeconds: 5
  failureThreshold: 3        # 약 30초 무응답이면 NotReady
# liveness: 데드락 수준만 재시작. 보수적으로 잡아
#           host 장애에 의한 무한 재시작 루프를 피한다.
livenessProbe:
  httpGet: { path: /_cluster/health?local=true, port: 9200 }
  periodSeconds: 30
  failureThreshold: 6        # 약 180초 무응답이어야 재시작
```

liveness를 일부러 관대하게 잡은 이유가 있다. **host 장애는 컨테이너 재시작으로 풀리지 않는다** — 재시작해도 같은 노드에 다시 뜨니까. liveness가 공격적이면 host가 얼어있는 내내 무한 재시작 루프만 돈다. readiness가 "응답성"을 보고 트래픽을 끊는 동안, liveness는 "진짜 데드락"에만 반응해야 한다.

## 함정 2 — 단일 노드풀을 drain하면 갈 곳이 없다

복구를 위해 노드를 cordon하고 drain으로 워크로드를 건강한 노드로 옮기려 했다. 그런데 evict된 pod들이 전부 `Pending`에 박혔다. `NODE: <none>` — 스케줄 자체가 안 됐다.

원인은 토폴로지였다. 그 워크로드들은 `nodeSelector`로 **특정 역할의 노드만** 지정하는데, 그 역할의 노드가 **방금 cordon한 한 대뿐**이었다. drain으로 비웠지만 받아줄 노드가 없으니 공중에 떴다. 스케줄러가 정확히 말해줬다.

```text
0/N nodes are available: 1 node(s) were unschedulable,
  M node(s) didn't match Pod's node affinity/selector.
```

> **교훈 2 — `drain`은 "옮긴다"가 아니라 "쫓아낸다"이다.** 특정 역할 노드가 1대뿐이고 그 역할을 강제하는 `nodeSelector` 워크로드가 있으면, 그 노드를 drain하는 순간 워크로드는 갈 곳을 잃는다. drain 전에 "이 워크로드가 갈 *다른* 노드가 있는가"를 먼저 확인해야 한다. 이건 단일 노드 역할 풀의 구조적 SPOF고, 가용성 follow-up으로 남겼다 — 그걸 실제로 고친 이야기는 [다른 글](/blog/anti-affinity-deploy-order-trap/)에 있다.

## 복구

drain으로는 옮길 수 없으니, **노드 자체를 살리는** 쪽으로 갔다. host freeze가 일시적(noisy-neighbor 가능성)일 수 있어 노드를 재부팅했다. 재부팅 후 노드가 Ready로 돌아왔고, uncordon하니 Pending이던 워크로드가 그 노드로 다시 스케줄됐다. 검색엔진이 재기동되며 로그에 정상 `started`가 찍히고 디스크 health 경고가 사라졌다 — host 회복 확정.

(재부팅은 같은 host에 다시 뜨는 것일 수 있어, 재발하면 노드를 새 host로 교체하는 게 다음 수순이다. 디스크 IO 6분 hang은 일시적 부하일 수도, 하드웨어 신호일 수도 있어 재발 여부로 가른다.)

## 가져갈 것

- **여러 도메인의 알람이 동시에 울리면, 공통 인프라 root를 먼저 의심하라.** 한 노드의 host freeze가 검색엔진·메트릭·노드 상태로 갈라질 수 있다.
- **probe 부재 = silent hang.** `1/1 Running`은 "프로세스가 산다"일 뿐 "응답한다"가 아니다. readiness로 응답성을, liveness로 데드락을 구분해 잡아라.
- **liveness는 보수적으로.** host 장애처럼 재시작으로 안 풀리는 문제에 공격적 liveness는 무한 재시작 루프를 만든다.
- **`drain`은 받아줄 노드가 있을 때만 "옮긴다"가 된다.** 단일 역할 노드 풀에선 drain이 Pending만 만든다 — drain 전에 갈 곳을 확인하라.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
