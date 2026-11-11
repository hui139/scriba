<div align="center">

<img src="docs/images/logo.png" alt="Scriba" width="112" />

# Scriba

**오픈소스이며 플러그인으로 확장 가능한 WYSIWYG Markdown 에디터**

Markdown 문법은 조판 결과 뒤에 숨습니다. 커서가 있는 줄만 소스를 보여 주고, 나머지는 최종 모습 그대로 렌더링됩니다.

[![CI](https://github.com/hui139/scriba/actions/workflows/ci.yml/badge.svg)](https://github.com/hui139/scriba/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hui139/scriba?label=release)](https://github.com/hui139/scriba/releases/latest)
[![License](https://img.shields.io/github/license/hui139/scriba)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-4b5563)](#다운로드)

[English](README.en.md) · [简体中文](README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

</div>

![Scriba 스크린샷](docs/images/screenshot.png)

## 다운로드

<div align="center">

[![Scriba 다운로드](https://img.shields.io/badge/%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C-Scriba-6d28d9?style=for-the-badge&logo=github)](https://github.com/hui139/scriba/releases/latest)

**[⬇ 최신 릴리스 받기](https://github.com/hui139/scriba/releases/latest)**

</div>

이전 버전을 포함한 모든 릴리스: [releases](https://github.com/hui139/scriba/releases)

| 플랫폼 | 파일 | 설치 |
| --- | --- | --- |
| **Windows** 10/11 (x64) | `Scriba-<버전>-win-x64.exe` | 설치 프로그램 실행 |
| **macOS** (Apple Silicon) | `Scriba-<버전>-mac-arm64.dmg` | 열어서 Scriba를 「응용 프로그램」으로 끌어다 놓기 |
| **macOS** (Intel) | `Scriba-<버전>-mac-x64.dmg` | 위와 같음 |
| **Linux** (x64) | `Scriba-<버전>-linux-x86_64.AppImage` | `chmod +x` 후 실행 |

> **설치 파일에는 코드 서명이 없습니다.** 처음 실행할 때 운영체제가 경고를 표시합니다.
>
> - **Windows**: SmartScreen이 "Windows에서 PC를 보호했습니다"를 표시 → "추가 정보" → "실행".
> - **macOS**: "개발자를 확인할 수 없습니다" 표시 → "시스템 설정 → 개인정보 보호 및 보안"에서 허용하거나 앱을 마우스 오른쪽 단추로 클릭해 "열기".
> - **Linux**: 먼저 `chmod +x`로 실행 권한을 부여해야 합니다.
>
> 설치 파일은 GitHub Actions가 이 저장소의 소스로 빌드합니다([release.yml](.github/workflows/release.yml)). 과정을 직접 확인하거나 소스에서 빌드할 수 있습니다.

## 기능

**작성 환경**

- 제목, 굵게, 기울임, 취소선, 형광펜, 밑줄, 위/아래 첨자, 인라인 코드, 링크, 이미지, 인용, 목록, 작업 목록, 구분선, 각주, `[TOC]`, YAML 프런트매터를 입력하는 즉시 렌더링
- 표를 직접 편집: 행·열 추가, 마우스 오른쪽 단추로 정렬 지정, 열 경계를 끌어 너비 조정(두 번 클릭하면 자동 너비로 복귀)
- 스크린샷이나 이미지 파일을 붙여넣거나 끌어다 놓으면 `assets/`에 저장되고 링크가 자동 삽입됩니다. `=200x` 크기 문법 지원
- Enter로 목록 이어 쓰기, Backspace로 기호 삭제, 선택한 텍스트에 URL을 붙여넣으면 링크로 변환
- 워크스페이스 전체 검색, 개요 사이드바, 탭, 최근 파일, 소스 모드
- 찾기 및 바꾸기: 대/소문자 구분, 단어 단위, 정규식, 모두 바꾸기
- 집중 모드, 타자기 모드

**조판과 내보내기**

- KaTeX 수식(인라인 `$...$`, 블록 `$$...$$`)과 Mermaid 다이어그램 실시간 렌더링
- HTML, PDF, Word, 일반 텍스트, PNG, LaTeX, EPUB로 내보내기(제목에서 여러 단계 목차 생성)
- 상대 경로 이미지는 내보낼 때 자동으로 인라인 처리되며, EPUB은 이미지를 압축 파일에 함께 넣습니다
- 폴더 내보내기: Markdown과 이미지 리소스를 함께 복사
- 내보내기 스타일 템플릿: `<userData>/export-templates/`에 CSS를 넣으면 적용됩니다

**개인 설정**

- 기본 테마 6종(기본값은 앱 아이콘 색상에서 가져온 Violet Night), 사용자 CSS와 플러그인 테마 지원
- 인터페이스 확대 85%–140%, 본문 글자 크기는 따로 조정
- 모든 단축키를 바꿀 수 있으며, 충돌하면 이전 지정이 자동으로 해제됩니다
- 인터페이스 언어: English / 简体中文, 플러그인으로 언어 추가 가능

**확장성**

- JavaScript 플러그인이 명령, 단축키, 상태 표시줄 항목, 사이드바 패널, 코드 블록 렌더러, 테마, 언어를 등록할 수 있습니다
- 플러그인 마켓은 GitHub의 `scriba-plugin` 토픽으로 검색·설치하며 중앙 인덱스가 필요 없습니다

## 소스에서 빌드

**Node.js 20+** 와 npm 10+ 가 필요합니다.

```bash
git clone https://github.com/hui139/scriba.git
cd scriba
npm ci
npm run dev
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 모드(핫 리로드) |
| `npm run build` | `out/`으로 빌드 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm test` | 모든 테스트(단위 테스트 + UI 스모크 테스트) |
| `npm run test:compat` | 단위 테스트: 버전 호환성과 매니페스트 지역화 |
| `npm run smoke` | UI 스모크 테스트: 실제 앱을 조작해 검증 |
| `npm run dist` | 현재 플랫폼용 설치 파일을 `release/`에 생성 |
| `npm run icons` | 원본 이미지에서 모든 아이콘 재생성 |

<details>
<summary>중국 본토 네트워크: 의존성 다운로드가 느리거나 실패하는 경우</summary>

```bash
# npm 의존성에 미러 사용
npm install --registry=https://registry.npmmirror.com

# Electron 바이너리를 미러로 경유(PowerShell)
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com
```

시작할 때 `libpng warning: iCCP: known incorrect sRGB profile`이 보인다면 Electron에 포함된 Chromium에서 출력되는 것이며 앱 코드나 아이콘과 무관합니다. 기능에는 영향이 없습니다. `SCRIBA_SHOW_ELECTRON_WARNINGS=1`을 설정하면 필터링되지 않은 출력을 볼 수 있습니다.

</details>

## 문서

| 문서 | 내용 |
| --- | --- |
| [프로젝트 소개](docs/PROJECT.md) · [English](docs/PROJECT.en.md) | 설계 판단, 아키텍처, 구현 세부 사항(중국어) |
| [플러그인 API](docs/PLUGIN_API.md) · [English](docs/PLUGIN_API.en.md) | 플러그인 인터페이스 전체 참조와 예제(중국어·영어) |
| [플러그인 규격](docs/PLUGIN_SPEC.md) | 이름, 매니페스트, 배포, 검증 규칙(중국어) |
| [마켓플레이스](docs/MARKETPLACE.md) | GitHub 검색과 JSON 인덱스 두 가지 방식(중국어) |
| [기여 안내](CONTRIBUTING.md) | 개발 흐름과 커밋 규칙(중국어) |

## 플러그인

플러그인은 `<userData>/plugins/<플러그인 ID>/`에 두며, `manifest.json`과 `activate(scriba)`를 내보내는 CommonJS 진입점을 포함합니다.

```js
module.exports.activate = (scriba) => {
  scriba.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    run: () => scriba.ui.showToast('Hello from my plugin!')
  })
}
```

전체 API는 [docs/PLUGIN_API.md](docs/PLUGIN_API.md)를 참고하세요. 앱 안의 **플러그인 관리자**에서 활성화·비활성화하거나 폴더에서 설치할 수 있습니다.

플러그인은 배포도 됩니다. 공개 저장소에 `scriba-plugin` 토픽을 추가하면 앱 안의 플러그인 마켓에 나타납니다. 이름과 배포 요건은 [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md)를 참고하세요.

## 프로젝트 구조

```
src/
  main/             Electron 메인 프로세스(창, 파일 시스템, 플러그인, 내보내기, 업데이트 확인)
  preload/          contextBridge API
  renderer/         React 렌더러
    src/editor/     CodeMirror 에디터와 라이브 미리보기
    src/plugins/    플러그인 런타임과 기여 지점 레지스트리
    src/components/ UI 컴포넌트
    src/markdown/   Markdown → HTML(내보내기용)
plugins/            기본 플러그인(읽기 시간, 코드 언어 라벨)
scripts/            실행기, 아이콘 빌드, 테스트
docs/               문서
```

## 보안

플러그인은 렌더러에서 실행되는 일반 JavaScript이며 에디터와 같은 권한을 가집니다. **신뢰하는 플러그인만 설치하세요.** 컨텍스트 격리를 사용하며 콘텐츠 보안 정책에 `unsafe-eval`을 포함하지 않습니다. 플러그인 진입점은 Blob 모듈로 읽으므로 `script-src blob:`만 필요합니다.

현재 플러그인에는 서명과 샌드박스가 없으며, 이는 알려진 제한으로 [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md#九已知限制)에 정리되어 있습니다.

## 로드맵

- [ ] 버전 기록
- [ ] 협업 및 클라우드 동기화(선택)

이미 구현된 기능은 [Releases](https://github.com/hui139/scriba/releases)와 커밋 기록을 참고하세요.

## 기여

Issue와 Pull Request를 환영합니다. 시작 전에 [CONTRIBUTING.md](CONTRIBUTING.md)를 읽어 주세요. 제출 전에 `npm run typecheck`, `npm test`, `npm run build`가 통과하는지 확인하세요. CI는 Windows, macOS, Linux 세 플랫폼에서 이 검사를 실행합니다.

## 라이선스

[MIT](LICENSE) © Scriba Contributors

앱 아이콘은 프로젝트 전용 자료이며 저작권은 해당 제작자에게 있습니다. 위 MIT 라이선스가 적용되지 않습니다.
