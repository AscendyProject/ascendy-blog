---
title: "recreate 한 번에 벡터DB가 영영 안 떴다 — compose `${VAR}` 보간 ≠ env_file"
description: "워커 하나만 다시 만들려고 --force-recreate를 돌렸는데, 의존성을 따라 벡터DB까지 재생성되더니 영영 'starting'에 멈췄다. 원인은 빈 스토리지 키 — docker-compose의 ${VAR} 보간은 서비스의 env_file이 아니라 파싱 시점 호스트 셸/top-level .env에서 해석된다. env_file이 붙어 있어도 안 고쳐진다."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["docker-compose", "vector-database", "object-storage", "silent-failure", "credentials", "root-cause-analysis"]
category: "infra"
lang: "ko"
translationKey: "compose-interpolation-not-env-file"
sourceIntake:
  - "docs/intake/from-infra/2026-05-31-compose-interpolation-not-env-file.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 워커 컨테이너 하나만 다시 만들려고 `docker compose up -d --force-recreate <worker>`를 돌렸다. 그런데 compose가 의존성을 따라 **벡터DB까지 재생성**했고, 그 벡터DB가 영영 `health: starting`에 멈췄다.
- 진짜 원인은 **빈 스토리지 키**였다. 벡터DB가 오브젝트 스토리지 버킷에 `400`으로 막혀 내부 coordinator가 등록을 못 했는데, 에러는 없고 화면엔 "starting" 한 단어뿐이었다.
- 키가 왜 비었나 — **docker-compose의 `${VAR}` 보간은 *파싱 시점*에 호스트 셸(또는 top-level `.env`)에서 해석된다.** 서비스에 `env_file`이 붙어 있어도 소용없다. `env_file`은 컨테이너 *안쪽* 환경이지, `${...}` 보간에는 **전혀 기여하지 않는다.** 둘은 다른 층이다.
- 자격증명 없는 셸에서 `--force-recreate`가 그 서비스를 다시 만드는 순간, 보간 값이 빈 문자열로 박혔다.

> **소스 노트.** 이 글은 상위 인프라 팀의 인테이크(`docs/intake/from-infra/2026-05-31-compose-interpolation-not-env-file.md`)를 정제한 것이다. 오브젝트 스토리지 공급자·버킷, 실제 환경변수 이름, 서비스·파일 이름, 벡터DB 제품명은 일반화했다. 실제 키 값은 본문 어디에도 없다 — "키가 비어 있었다"는 *현상*만 다룬다. 이 함정은 로컬 dev 한정이고(프로덕션은 다른 시크릿 메커니즘이라 이 보간 함정 자체가 없다), remediation은 이미 적용됐다.

## 워커 하나 만지려다 벡터DB가 멈췄다

별건(워커 기동 명령)을 검증하다 `--force-recreate`로 워커 컨테이너 하나만 다시 만들려고 했다. 그런데 compose는 **의존성 그래프를 따라** 벡터DB까지 재생성했다. 그리고 그 벡터DB가 그 뒤로 healthcheck를 영영 통과하지 못했다 — 몇 분이 지나도 `health: starting`. 워커는 떴지만 앱 초기화가 벡터DB 연결 재시도에 막혔고, 스케줄러는 연결 실패로 종료됐다.

처음 의심은 자연스러운 쪽으로 흘렀다. "벡터DB가 느리게 뜨나" → "재시작 충격으로 내부 상태가 깨졌나(coordinator 미등록)". 그런데 단순 restart도, full recreate도 안 풀렸다. 로그를 좁혀 들어가자 진짜 원인이 나왔다.

## 로그가 가리킨 곳 — 빈 스토리지 키

이 벡터DB는 여러 내부 컴포넌트(메타·데이터·쿼리 coordinator 등)로 구성된다. 로그에서 **메타 coordinator는 `Healthy`**인데 **데이터·쿼리 coordinator는 "find no available …, check … state"**로 끝없이 재시도하고 있었다. 그리고 그 사이 결정적인 한 줄.

```text
storage ... ["failed to check blob bucket exist"] [bucket=<…>] [error="400 Bad Request"]
```

이 벡터DB는 오브젝트 스토리지(S3 호환)에 메타·데이터를 올린다. 그런데 그 **버킷 접근이 `400`**으로 실패하고 있었다. 데이터·쿼리 coordinator는 스토리지 초기화가 안 되면 등록을 못 한다 → "starting" 무한 루프. 즉 벡터DB가 깨진 게 아니라 **스토리지 자격증명이 비어 있었다.** 내내 흘려보던 경고 한 줄이 그제야 눈에 들어왔다.

```text
WARN: The "OBJSTORE_ACCESS_KEY" variable is not set. Defaulting to a blank string.
```

## 왜 비었나 — 보간은 env_file이 아니다

compose의 벡터DB 서비스는 스토리지 키를 이렇게 받고 있었다.

```yaml
services:
  vectordb:
    env_file:
      - ./path/to/secrets.env   # ← 컨테이너 안쪽 env. ${...} 보간엔 기여 안 함.
    environment:
      OBJSTORE_ACCESS_KEY: "${OBJSTORE_ACCESS_KEY}"   # ← 파싱 시점 호스트/.env 에서 해석
      OBJSTORE_SECRET_KEY: "${OBJSTORE_SECRET_KEY}"   #   셸에 없으면 빈 문자열
```

여기 함정의 핵심이 있다. `${...}`는 **compose가 파일을 파싱하는 시점**에, **호스트 셸 환경변수**(또는 같은 디렉터리의 top-level `.env`)에서 해석된다. 이 서비스엔 `env_file`도 붙어 있었지만 — **`env_file`은 컨테이너 *안쪽* 환경에만 들어가지, 파싱 시점의 `${...}` 보간에는 전혀 기여하지 않는다.** 두 메커니즘은 완전히 다른 층이다.

그래서 평소 운영자가 자격증명이 로드된 셸로 스택을 올릴 땐 멀쩡했다. 그런데 **자격증명 없는 셸**에서 `--force-recreate`가 벡터DB를 다시 만드는 순간, `${OBJSTORE_ACCESS_KEY}`가 **빈 문자열**로 박혔다. 빈 키로는 버킷 인증이 안 되니 `400`, coordinator가 못 떠서 stuck — 이 모든 게 에러 한 줄 없이 "starting"으로만 보였다.

복구는 허무할 만큼 단순했다. **자격증명을 셸에 로드한 뒤** 벡터DB를 다시 recreate. 데이터 볼륨은 멀쩡했다 — 자격증명 문제였지 손상이 아니었으니까.

## 진짜 교훈은 비대칭이다

같은 스택의 다른 서비스(워커·스케줄러)는 **`env_file`로 자격증명을 받아서 셸과 무관하게 항상 정상**이었다. 오직 벡터DB만 `${...}` **호스트 보간**으로 받아 셸에 의존했다. 이 비대칭이 함정의 정체다.

"스택이 평소 잘 뜨니까 자격증명은 어딘가 잘 들어가고 있다"는 믿음은, recreate 대상이 하필 **보간-의존 서비스**일 때 조용히 깨진다. 게다가 그 서비스에 `env_file`이 붙어 있다는 사실이 **"자격증명은 파일에서 오니까 안전하다"는 잘못된 안심**을 준다. 실제로 키를 채운 건 그 파일이 아니라 호스트 셸이었는데도.

작은 결론은 "셸에 자격증명 로드하고 recreate하면 끝." 큰 결론은 이렇다 — **compose의 `${VAR}` 보간과 서비스 `env_file`은 다른 메커니즘이고, 한 스택에서 두 방식이 섞이면 "recreate 안전성"이 서비스마다 달라진다.** 보간-의존 값은 top-level `.env`(compose가 자동 로드)로 고정해 셸 의존성을 없애는 게 정공법이다.

```bash
# 정공법: top-level .env(compose가 자동 로드)로 셸 의존성 제거.
#   .env.example을 템플릿으로 둬서 "어떤 ${VAR}가 필요한지" 가시화.
# 즉석 복구: 자격증명을 셸에 로드한 뒤 recreate.
set -a; source path/to/secrets.env; set +a
docker compose up -d --no-deps --force-recreate vectordb   # --no-deps로 blast radius 차단
```

## 가져갈 것

- **`${VAR}` 보간 ≠ `env_file`.** 보간은 파싱 시점 호스트 셸/top-level `.env`에서, env_file은 컨테이너 안쪽 env로 — 다른 층이다. env_file은 `${...}`를 채우지 않는다.
- **자격증명 없는 셸의 `--force-recreate`는 보간 값을 빈 문자열로 조용히 주입한다.** "variable is not set, defaulting to blank" 경고는 쉽게 묻힌다.
- **`--force-recreate <svc>`는 의존성을 따라 다른 서비스까지 재생성한다.** 한 서비스만 건드리려면 `--no-deps`.
- **오브젝트 스토리지 기반 벡터DB는 스토리지 접근이 막히면 등록 자체를 못 한다.** 증상은 "그냥 starting", 원인은 한참 떨어진 스토리지 인증 — 메타 coordinator만 Healthy면 스토리지를 의심하라.
- **자격증명 주입 방식이 서비스마다 다르면 "recreate 안전성"이 비대칭이 된다.** 보간-의존 값은 top-level `.env`로 고정하라.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
