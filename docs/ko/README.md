# UML Studio

[English](../../README.md) · [기여 안내](../../CONTRIBUTING.md) · [제품 기획안](product-spec.md) · [원자 단위 실행 계획](atomic-execution-plan.md) · [작업 목록](../roadmap.md)

텍스트 DSL과 캔버스를 함께 사용하는 로컬 UML 편집기입니다. Electron, React, TypeScript, Monaco, Konva로 개발합니다.

**현재는 개발용 알파입니다.** DSL 왕복 변환에서 속성이나 포함 관계가 달라지는 결함이 남아 있습니다. 중요한 설계의 유일한 원본으로 사용하지 마세요. [알려진 제한](../known-limitations.md)과 [상세 검토(한국어)](../reviews/2026-09-26-commercial-readiness.md)를 확인하세요.

## 시작하기

Node.js 24, npm, Git이 필요합니다.

```bash
git clone https://github.com/PKDGOOD/uml-desktop-client.git
cd uml-desktop-client
nvm use # nvm을 사용하는 경우
npm ci
npm run dev
```

Electron 앱은 자동 실행됩니다. 브라우저만 실행하려면 `npm run dev:browser`를 사용합니다. `+ Diagram`에서 다이어그램을 만들고 [예제](../../examples/order-system.uml)를 Editor에 붙여넣을 수 있습니다. Open은 `.uml.json` 프로젝트 파일을 받습니다.

## 제공 범위

- 클래스·시퀀스·유스케이스·액티비티·상태 다이어그램
- 프로젝트/폴더/탭, 텍스트 편집과 캔버스, 속성 패널
- 다이어그램별 실행 취소, 앱 내부 복사·붙여넣기
- 파일 저장·열기, 기기 내 스냅샷, SVG·PNG 내보내기

자동 복구, PDF, 협업, 코드 생성과 계약 테스트는 제공하지 않습니다. 스냅샷은 파일에 포함되지 않습니다. 브라우저는 다운로드 요청 후에도 미저장 상태를 유지합니다. 파일이 실제로 받아졌는지 확인한 뒤 페이지를 닫으세요.

## 개발 및 참여

`npm run check`로 타입·저장소 문서/예제·테스트를 확인하고 `npm run build:app`으로 번들을 만듭니다. macOS Apple Silicon에서는 파일 선택 응답을 자동화한 실제 패키지 저장·재시작·재열기 검증을 추가했습니다. [실행 현황](../execution-status.md)과 [검증 절차](../testing.md)를 참고하세요. Windows/Linux CI 설정은 데스크톱 배포 품질 검증을 의미하지 않습니다.

기본 문서와 리뷰 언어는 영어이며 한국어 이슈도 환영합니다. [기여 규칙](../../CONTRIBUTING.md), [행동강령](../../CODE_OF_CONDUCT.md), [보안 신고](../../SECURITY.md), [지원 안내](../../SUPPORT.md)를 참고하세요. 보안 세부 사항이나 회사·개인 자료를 공개 이슈에 첨부하지 마세요.

이 프로젝트는 [MIT 라이선스](../../LICENSE)로 제공하며 의존성에는 각자의 [라이선스 고지](../../THIRD_PARTY_NOTICES.md)가 적용됩니다. 공개 소스 준비와 상용 제품 완성도는 별도로 관리합니다.
