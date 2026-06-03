---
title: "장기 키 없이 GitHub Actions에서 GCP로 — 어려운 건 WIF 스펙이 아니라 그 주변이었다"
description: "SA 키를 받아 Secret에 붙이는 뻔한 경로 대신, 콘솔 경고대로 Workload Identity Federation을 택했다. 스펙 자체는 짧은데 그 주변 디테일 — 자격증명 5분 수명, immutable ID 바인딩, GPP의 ADC opt-in, JAVA_HOME 레이스 — 에서 6일을 태웠다. static review가 잡은 것과 live 실행만 드러낸 것의 경계."
pubDate: 2026-06-03
author: "Ascendy Engineering"
tags: ["workload-identity-federation", "github-actions", "gcp", "ci-cd", "oidc", "security"]
category: "infra"
lang: "ko"
translationKey: "wif-github-actions-gcp"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-01-wif-github-actions-gcp.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 안드로이드 배포 자동화를 **SA 키를 받아 GitHub Secret에 붙이는** 뻔한 경로로 시작했다가, GCP 콘솔의 경고("키를 다운로드하지 말고 Workload Identity Federation을 쓰라")를 보고 WIF로 갈아탔다.
- **WIF 스펙 자체는 짧다.** 6일이 걸린 건 그 주변 디테일이었다 — 자격증명 수명이 1시간이 아니라 **5분**이라는 것, provider 조건을 **mutable 이름이 아니라 immutable 숫자 ID**에 묶어야 한다는 것, Gradle Play Publisher가 ADC를 자동으로 켜주지 않는다는 것, 러너의 JDK 버전 레이스.
- **static review 5라운드**가 diff만으론 안 보이는 구멍 7개를 잡았다. 그런데도 첫 **live 실행은 3번 더 실패**했다 — static review가 원리적으로 볼 수 없는 것들이었다(API 미활성화, 러너 환경, 스텝 순서).
- 교훈은 그 경계에 있다: 스펙 대조가 잡는 것과, 실제로 한 번 돌려봐야만 드러나는 것은 다르다.

> **소스 노트.** 이 글은 프론트엔드 팀이 안드로이드 내부 테스트 배포 파이프라인을 옮기며 남긴 인테이크(`docs/intake/from-frontend/2026-06-01-wif-github-actions-gcp.md`)를 정제한 것이다. GCP 프로젝트·서비스 계정·Pool/Provider 식별자, 저장소 이름과 숫자 ID는 placeholder로 일반화했다. 여기 적힌 패턴(WIF 흐름, immutable-ID 바인딩, 5분 ceiling, GPP의 ADC opt-in, JAVA_HOME pin)은 모두 Google·GitHub·GPP 공식 가이드의 적용 사례다.

## 시작은 뻔한 길이었다

처음엔 누구나 가는 길로 갔다. Service Account JSON 키를 발급받아 base64로 인코딩하고, GitHub repository Secret에 붙인 뒤, 워크플로 안에서 디코드해서 쓴다. 동작은 한다. 그런데 키를 만드는 화면에서 GCP 콘솔이 표준 경고를 띄웠다.

> Service account keys could pose a security risk if compromised. We recommend you avoid downloading service account keys and instead use the Workload Identity Federation.

장기 키 한 장이 유출되면 그게 곧 GCP 권한이다. 만료도, 회전도 우리가 직접 챙겨야 한다. 경고의 권고를 따르기로 했다 — 그리고 그게 6일짜리 여정의 시작이었다. 분명히 해두자면, 어려웠던 건 **WIF가 무엇인가**가 아니다. WIF의 큰 그림은 한 문단이면 끝난다. 우리를 붙잡은 건 그 **주변의 작은 디테일들**이었다.

## 동작한 그림

핵심 흐름은 이렇다. 장기 키는 어디에도 없다.

```
GitHub OIDC token  ──▶  GCP STS subject token  ──▶  SA 임프로네이션
   (5분 수명)              (WIF로 교환)               (ADC 체인)
```

워크플로에 필요한 건 세 가지다.

- `permissions: id-token: write`를 최상위에. 없으면 auth 스텝이 `OIDC token request not authorized for this workflow`로 죽는다.
- `google-github-actions/auth`를 floating tag가 아니라 **full commit SHA**에 pin. 자격증명을 다루는 워크플로이기 때문이다.
- 입력 세 개를 명시적으로 잠근다: `create_credentials_file: true`, `export_environment_variables: true`, `cleanup_credentials: true`. 다음 메이저에서 기본값이 바뀌면 조용히 계약이 어긋나니, 잠가서 드리프트를 막는다.

## 디테일 1 — 신뢰 경계는 immutable 숫자 ID다

provider 조건의 첫 시도는 뻔한 것이었다.

```
attribute.repository == 'org/repo'
```

자격증명 경로에선 이게 틀렸다. **저장소 이름은 바뀔 수 있다** — rename, transfer, 그리고 삭제 후 누군가 같은 이름을 다시 차지(squat)하는 것도 가능하다. 잠깐 그 이름을 차지한 공격자가 조건을 만족하는 OIDC 토큰을 발급할 수 있다는 뜻이다. 올바른 형태는 GitHub이 함께 내보내는 **불변 숫자 ID**에 묶는다.

```
attribute.repository_id == '<numeric>' &&
attribute.repository_owner_id == '<numeric>' &&
attribute.ref == 'refs/heads/main'
```

`attribute.ref`도 빼면 안 된다. 애플리케이션 레이어에 "main에서만" 가드가 있더라도, 그 가드는 IAM이 OIDC 토큰을 평가한 **다음에** 실행된다. 같은 저장소의 다른 워크플로가 non-main 브랜치에서 auth를 호출하면, 애플리케이션 게이트가 발동하기도 전에 OIDC 교환이 IAM 단에서 통과해버린다. 우리가 쓴 attribute-scoped 구성에서는 `principalSet://...` IAM 바인딩도 `repository/<name>`이 아니라 `repository_id/<numeric>`을 쓴다. 바인딩 형태 자체가 핵심은 아니다 — mutable 문자열 식별자는 trapdoor고, immutable 숫자 ID가 신뢰 경계라는 게 핵심이다.

## 디테일 2 — 자격증명은 1시간이 아니라 5분 산다

가장 많이 틀렸고 가장 많이 고친 오해다. auth 액션은 두 가지 흐름을 내보낸다.

| 흐름 | 유효 수명 |
|---|---|
| `create_credentials_file: true` (이 패턴이 쓰는 ADC config) | **5분** — 파생 자격증명이 GitHub OIDC 토큰의 만료를 상속한다 |
| `token_format: access_token` (다른 흐름) | 최대 1시간. 대신 평문 access token이 러너 환경에 남는다 |

평문 토큰이 러너에 남지 않는 첫 번째를 택했다. 운영상 함의는 분명하다 — **auth 스텝부터 Play 업로드까지 전부 5분 안에** 끝나야 한다. 그래서 auth 스텝을 `npm ci`와 안드로이드 빌드 뒤, Gradle 업로드 **직전**으로 최대한 늦췄다. 반대로, STS 교환을 미리 당겨두는 "warmup" 스텝은 넣지 않았다 — 예산을 당겨 쓸 뿐 늘려주지 않기 때문이다. (static review가 "warmup으로 시간을 벌자"는 제안을 정확히 이 이유로 잘라냈다.)

## 디테일 3 — GPP는 ADC를 알아서 켜주지 않는다

Gradle Play Publisher(GPP)는 `serviceAccountCredentials.set(...)`을 지운다고 해서 ADC를 자동으로 켜지 않는다. README의 인증 절대로, 명시적인 인증 전략 선택을 요구하고, 없으면 `No credentials specified`로 실패한다.

```gradle
play {
    def adcPath = System.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if (adcPath) {
        useApplicationDefaultCredentials.set(true)
        resolutionStrategy.set(ResolutionStrategy.AUTO)
    }
}
```

`GOOGLE_APPLICATION_CREDENTIALS` 존재 여부로 거는 이 게이트는 **로컬/CI 분기**도 겸한다. ADC가 없는 로컬 `bundleRelease`는 GPP 기본 `IGNORE` 전략에 머물러, version-code를 해석하려 Play를 조회하다 실패하는 일이 없다.

## 디테일 4 — setup-java 순서와 JAVA_HOME 레이스

`actions/setup-java`와 `android-actions/setup-android`는 눈에 안 띄는 방식으로 얽힌다.

- `setup-android`의 `sdkmanager --licenses`는 JDK 17 이상을 요구한다. 그런데 ubuntu-22.04 러너의 기본 `JAVA_HOME`은 (우리가 마주친 러너 스냅샷 기준) JDK 11을 가리켰다 — 러너 이미지는 시간이 지나며 바뀐다. 그래서 `setup-java`가 **먼저** 돌아 `sdkmanager`가 JDK 21을 보게 해야 한다.
- 이후 어떤 스텝이든 `JAVA_HOME`을 바꿔칠 수 있다. 그래서 Gradle 호출 스텝에서 `env: JAVA_HOME: ${{ steps.setup-java.outputs.path }}`로 launching JVM을 못 박았다. 셸 레벨의 Java만으로는 부족하다 — `invalid source release: 21` 오류를 결정하는 건 Gradle을 띄우는 JVM이기 때문이다.

진단 스텝 두 개는 **영구로** 남겼다. `setup-java` 뒤에 `echo "$JAVA_HOME"; java -version`, Gradle 호출 안에 `./gradlew --version`. 임시로 넣었다 빼면, 다음 툴체인 드리프트가 2분짜리 컴파일 오류로 다시 나타난다. 영구로 두면 다음 dispatch 로그에 바로 찍힌다.

## static review가 잡은 것 vs live만 드러낸 것

이 마이그레이션의 진짜 교훈은 여기 있다.

변경은 APPROVE까지 **다섯 라운드의 static review**(변경을 그것이 구현한다고 주장하는 스펙과 대조하는 정독)를 거쳤다. 매 라운드가 diff만으론 안 보이는 실제 구멍을 잡았다 — GPP의 ADC opt-in 누락, mutable 이름 조건, auth 스텝이 긴 빌드 앞에 놓인 것, "1시간 ceiling" 과대주장, "warmup으로 예산 연장" 오해, 안 쓰는 흐름의 입력을 추가하란 제안, "검증된 옵션"이라는 과한 표현. 전부 diff는 내부적으로 일관됐는데, 공식 문서와 대조하자 틈이 드러난 경우였다.

그런데 다섯 라운드를 모두 통과한 뒤에도, **첫 live 실행은 세 번 더 실패했다.**

1. **Google Play Android Developer API 미활성화.** WIF는 성공했고 GPP는 자격증명을 받았고 Play를 호출했는데, Play가 `SERVICE_DISABLED`를 돌려줬다. 콘솔에서 원클릭.
2. **워크플로의 `java-version: 17`.** Capacitor 8의 안드로이드 모듈이 source/target에 `JavaVersion.VERSION_21`을 선언하는데, JDK 17은 source 21을 못 받는다. 로컬 빌드가 이걸 숨겼던 이유는 Android Studio 번들 JBR이 JDK 21이라서였다.
3. **스텝 순서.** `setup-android`를 `setup-java` 앞에 둔 too-clever한 스왑이, `sdkmanager`가 러너에 사전설치된 JDK 11을 찾아 거부하게 만들었다. 되돌렸다.

세 가지 모두 **스펙 대조로는 잡을 수 없는** 것들이다 — 외부 클라우드의 활성화 상태, 러너에 실제로 깔린 JDK, 실행 환경의 부작용. static review의 일은 "변경이 스펙대로인가"를 보는 것이고, 그건 거기까지다. 그 너머는 한 번 돌려봐야 보인다. (디테일 4에서 영구로 남긴 진단 스텝 덕분에 2·3번은 다음 dispatch 로그에서 30초 만에 보였다.)

## 결정과 트레이드오프

- **SA 키 vs WIF.** 장기 키는 셋업이 5분이지만 유출 시 무기한 유효하고 회전이 수동이다. WIF는 셋업이 며칠이지만 자격증명이 5분만 살고 평문이 어디에도 안 남는다. 반복 배포 파이프라인이라면 초기 비용을 치를 가치가 있다.
- **5분 흐름 vs 1시간 흐름.** ADC config 흐름(5분)은 평문 토큰을 남기지 않는 대신 파이프라인을 5분 예산 안에 욱여넣어야 한다. `access_token` 흐름(1시간)은 여유롭지만 평문 토큰이 러너에 상주한다. 우리는 노출 표면을 줄이는 쪽을 택했다.
- **mutable 이름 vs immutable ID.** 이름 바인딩은 읽기 쉽지만 rename/squat에 열려 있다. 숫자 ID 바인딩은 읽기 불편하지만 신뢰 경계가 단단하다. 자격증명 경로에선 가독성을 양보했다.

## 계속 가져갈 패턴

- 자격증명을 다루는 워크플로의 모든 액션은 **full commit SHA**에 pin(읽기용 tag는 뒤 주석으로). floating 메이저 tag는 비자격증명 경로에만.
- 최상위 `permissions:`는 `contents: read` + `id-token: write`만. 나머지는 default-deny.
- 자격증명의 유효 수명은 auth 액션이 광고하는 능력이 아니라 **선택한 흐름**에 달렸다. 쓰는 흐름의 "Token lifetimes" 절을 읽어라.
- 작은 idempotent `setup-wif.sh` 한 장이면 Pool/Provider/SA 재발급이 나중에 30초 작업이 된다. 운영 runbook 자산이다.
- `JAVA_HOME`과 `./gradlew --version`을 찍는 진단 스텝은 임시가 아니라 **영구**로. 툴체인 드리프트는 터지기 전까지 조용하다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
