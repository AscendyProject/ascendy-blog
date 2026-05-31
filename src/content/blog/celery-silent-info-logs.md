---
title: "ERROR는 보이는데 INFO만 사라졌다 — Celery 로그를 삼킨 두 겹의 함정"
description: "Celery 워커의 INFO 로그가 한 줄도 안 찍혔다. 원인은 두 겹 — Python 로깅이 워커 진입점에서 초기화되지 않은 것과, docker-compose의 YAML block scalar가 줄바꿈을 보존해 bash가 명령을 토막낸 것. 'ERROR는 보이고 INFO만 없다'는 비대칭에서 출발한 디버깅 기록."
pubDate: 2026-05-31
author: "Ascendy Engineering"
tags: ["celery", "python-logging", "docker-compose", "yaml", "observability", "debugging"]
category: "backend"
lang: "ko"
translationKey: "celery-silent-info-logs"
sourceIntake:
  - "docs/intake/from-backend/2026-05-30-silent-celery-info-and-yaml-newlines.md"
draft: false
redactionReviewed: true
---

## TL;DR

- Celery 워커에서 "태스크 시작" INFO 로그가 **한 줄도** 안 찍혔다. 그런데 ERROR는 보였다 — 이 **비대칭**이 모든 단서의 출발점이었다.
- 원인은 한 개가 아니라 **두 겹**이었다: ① Python 로깅이 워커 진입점에서 INFO로 초기화되지 않음 ② docker-compose의 YAML block scalar(`|-`)가 줄바꿈을 보존해, bash가 워커 명령을 토막내 인자가 통째로 무시됨.
- 교훈: "한 증상엔 한 원인"이라는 가정이 위험하다. 그리고 디버깅 시간의 대부분은 코드 수정이 아니라 **비대칭을 알아채는 데** 쓰인다.

## 배경 — "안 도는 것"과 "도는데 로그만 묵음"은 다르다

다른 이슈를 쫓다가 워커 로그를 들여다봤다. 태스크 시작 INFO가 — 한 줄도 없었다. 처음 든 의심은 "워커가 죽어서 태스크가 안 도는 것 아닌가"였다. 그런데 ERROR 라인은 멀쩡히 찍히고 있었다.

**ERROR는 보이는데 INFO만 없다.** 이 비대칭은 "태스크가 안 돈다"가 아니라 "태스크는 도는데 INFO 레벨만 묵음"일 가능성을 가리킨다. 그래서 먼저 그 둘을 갈랐다 — 존재하지 않는 id로 태스크를 dispatch해서 `logger.error(...)` 한 줄을 강제로 끌어내는 **액티브 프로브**다.

```bash
# dispatch + consume 경로가 살아있는지 가르는 프로브:
# 존재하지 않는 id → not-found 경로가 logger.error(...)를 강제 호출
docker compose exec backend python -c "
from app.tasks.your_task import your_task
your_task.delay(99999)  # not-found path triggers logger.error
"
docker compose logs worker --since 30s | grep your_task
```

ERROR가 워커 stdout에 나왔다. 적어도 그 프로브 태스크의 dispatch+consume 경로는 살아있다는 뜻이고, 의심은 곧장 **"INFO가 필터링되고 있다"** 쪽으로 좁혀졌다.

## 원인 1 — Python 로깅이 워커에서 초기화되지 않았다

`logging.basicConfig(level=logging.INFO)`가 **웹 앱을 import할 때만** 실행되는 구조였다. 그런데 워커는 같은 코드로 들어오는 *다른 문*이다 — root logger를 기본값 WARNING으로 시작했고, app 모듈의 모든 `logger.info(...)`가 통째로 묵음이 됐다.

게다가 Celery prefork 자식 프로세스는 fork 이후에도 Celery 내부 셋업이 로깅 레벨을 다시 만지는 경우가 있어, 부모에서 한 번 설정하는 것만으로는 부족했다. 세 가지를 합쳐야 prefork 자식에서까지 INFO가 살아남았다.

```python
# 워커/비트 진입 모듈 상단: INFO를 모든 프로세스에서 살려내는 셋
import logging
from celery.signals import setup_logging, worker_process_init


def _configure_app_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        force=True,
    )


_configure_app_logging()


@setup_logging.connect
def _skip_celery_logging_setup(**kwargs):
    """시그널에 어떤 핸들러든 연결돼 있으면 Celery는 자기 로깅 셋업을 건너뛴다."""
    return


@worker_process_init.connect
def _init_logging_in_prefork_child(**kwargs):
    """prefork 자식마다 한 번 더 재적용 — fork는 핸들러를 상속하지만
    Celery의 per-child 셋업이 레벨을 되돌릴 수 있다."""
    _configure_app_logging()
```

## 원인 2 — YAML block scalar가 명령을 토막냈다

INFO는 살렸다. 그런데 또 뭔가 이상했다 — 워커의 `--concurrency` 설정이 무시되고 있었다. 컨테이너의 실제 CMD를 점검하니, `--loglevel`·`--queues`·`--concurrency`·`--max-memory-per-child` 같은 인자가 컨테이너 안에서 **별도의 (그리고 실패하는) 쉘 명령**으로 실행되고 있었다.

원인은 compose의 `command: |-`와 컨테이너 entrypoint의 조합이었다. literal block scalar(`|`)는 줄마다 LF를 그대로 **보존**한다. 여기에 핵심 조건이 붙는다 — Compose의 `command`가 자동으로 셸을 거치는 건 아니다. 우리 이미지의 entrypoint가 이 command 문자열을 `bash -lc`로 실행하는 구성이었고, 그 문자열이 bash로 넘어가는 순간 bash는 인용되지 않은 LF를 **명령어 구분자**로 처리한다. 결국 실제로는 `celery ... worker` 한 줄만 인자 0개로 돌고, 나머지 라인은 전부 별개의 (실패하는) 명령으로 흩어졌다. **한 개의 버그가 동시에** concurrency 미적용·메모리 제한 미적용·로그 레벨 미적용을 일으키고 있었다.

```yaml
# BAD: literal |-는 LF 보존 → 이 문자열을 bash -lc로 실행하는 entrypoint 구성에서 bash가 LF를 명령 구분자로 처리
command: |-
  celery -A app.celery_app:celery worker
    --loglevel=INFO
    --queues=default,heavy
    --concurrency=1

# OK 1: folded `>-`는 LF를 공백으로 접음 → 한 줄짜리 명령으로 도착
command: >-
  celery -A app.celery_app:celery worker
    --loglevel=INFO
    --queues=default,heavy
    --concurrency=1

# OK 2: list 형태는 exec-style이라 가장 명시적 (셸 해석이 필요하면 entrypoint 계약에 따라 다름)
command:
  - celery
  - -A
  - app.celery_app:celery
  - worker
  - --loglevel=INFO
  - --queues=default,heavy
  - --concurrency=1
```

## 다음에 같은 함정에 빠지지 않으려면

- **다중라인 `command:`를 보면** 먼저 컨테이너의 실제 CMD를 확인한다(`docker inspect` / `docker compose config`). YAML이 보낸 것과 bash가 받은 것이 다를 수 있다.
- **이 셋업에선** `basicConfig` + `setup_logging` + `worker_process_init`를 함께 둬야 prefork 자식까지 INFO가 살았다. `setup_logging`에 핸들러를 연결하면 Celery 자체 로깅 설정이 꺼지고, 자식 레벨에서 레벨이 되돌려지는 게 관측되면 `worker_process_init`에서 재적용한다. (셋이 모두 필요한지는 앱의 로거 생애주기·prefork 동작에 따라 다르다.)
- **ERROR-only 비대칭이 보이면** 액티브 프로브(없는 id로 `delay()` → `logger.error` 강제)로 "안 돈다" vs "도는데 묵음"을 먼저 가른다.

## 후속

- 한 증상에 두 원인이 겹칠 수 있다는 전제를 디버깅 기본값으로. 첫 원인을 고친 뒤에도 "증상이 완전히 사라졌나"를 다시 확인한다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
