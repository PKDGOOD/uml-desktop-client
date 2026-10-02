# 상용 준비도 검토 — 2026-09-26

판정: 상용 출시 보류. 개인 초안 작성용으로는 가능하나 중요한 설계 명세의 유일한 원본으로 사용하기에는 부적합하다. 코드 정적 검토, 실행 가능한 엔진 재현, 기존 테스트, TypeScript/번들 빌드, npm 공식 감사 결과를 근거로 한다. 이번 검토는 제품 코드를 수정하지 않았다.

## 검증

- npm test: 19개 파일, 284개 테스트 통과.
- npm run build:app: TypeScript와 renderer/main/preload 번들 성공.
- 런타임 재현: 실제 SyncEngine, parseDSL, serializeDSL, ProjectFileParser를 esbuild로 묶어 Node에서 실행했다.
- npm audit: 24개 취약 패키지 항목 (critical 1, high 18, moderate 4, low 1). 개발/전이 의존성과 실제 배포 런타임을 구분해야 하며 24개의 앱 공격 경로를 확인했다는 뜻은 아니다.
- 패키지 앱의 저장 후 재열기 E2E, 침투 테스트, 장시간/대규모 성능, OS별 설치·업데이트는 이번 검토에서 실행하지 않았다. 이전 수동 재열기 확인도 완료되지 않았으므로 통과로 간주하지 않는다.

## 출시 차단 결함

### F1 [P1] 텍스트 왕복 변환에서 사용자가 편집한 속성 유실 — 재현

위치: src/engine/syncEngine.ts:300, src/parser/dsl/serializer.ts:159, src/components/properties/PropertyPanel.tsx:33.

Order 클래스에 GUI와 같은 element-update 명령으로 stereotype=entity, visibility=private를 설정한 뒤, 생성된 DSL에 줄바꿈 하나를 추가하여 parse를 실행했다. 결과 properties는 name/attributes/methods만 남았다. serializer는 이 필드를 표현하지 않고 preserveIds는 ID/sharedRefId만 복원한다. 단순 텍스트 편집이 모델을 손실시킨다.

조치: 모델과 DSL의 정보 보존 계약을 명시하고 모든 지원 필드를 직렬화하거나 DSL 비표현 필드를 명시적으로 병합한다. 전체 속성에 대한 모델→DSL→모델 왕복 회귀 검증이 필요하다. 주석 역시 GUI 변경 시 전체 DSL 재생성으로 제거되므로 보존 정책을 정의해야 한다.

### F2 [P1] 복합 상태의 포함 관계 변경 — 재현

위치: src/parser/dsl/uml.pegjs:67, src/parser/dsl/serializer.ts:404.

입력:

```text
@state-diagram "QA"
composite-state Active {
 state Inside
}
state Outside
```

parse 후 serialize하면 Outside도 Active의 중괄호 내부에 들어간다. 파서가 계층을 평탄화하고 serializer는 배열에서 연속한 state를 모두 자식으로 추정한다. 유스케이스 경계에도 같은 순서 기반 구조가 있다.

조치: parentId 또는 명시적인 children/AST를 모델에 추가하고, 파일 버전 마이그레이션과 계층 왕복 검증을 갖춘다. 의미가 바뀌는 문제이므로 단순 화면 버그로 취급하면 안 된다.

### F3 [P1] 속성 편집으로 유효하지 않은 DSL 생성 후 오류를 숨김 — 재현

위치: src/components/properties/PropertyPanel.tsx:54, src/engine/syncEngine.ts:237, :100.

attribute name을 `bad name`으로 설정하면 onCanvasChange는 성공하고 getErrors()는 빈 배열이다. 하지만 생성한 DSL을 parseDSL로 검사하면 실패한다. restore가 생성 결과 검증 없이 오류를 비운다. 다시 열 때는 setDiagram의 파싱으로 오류가 나타나므로 같은 문서가 편집 직후와 재열기 이후 다르게 동작한다.

조치: 폼의 임시 입력과 커밋을 분리하고 명령 경계에서 도메인 검증을 수행한다. 모든 승인된 GUI 변경에 대해 생성 DSL이 유효하다는 불변조건을 보장한다.

### F4 [P1] 중복 ID·미정의 관계선·파일 버전 검증 누락 — 재현

위치: src/parser/project/projectFileParser.ts:140, :172, src/parser/dsl/uml.pegjs:84, src/components/canvas/ConnectorRenderer.tsx:110.

중복 element ID, 존재하지 않는 sourceId/targetId, metadata.version=999.0.0을 가진 JSON이 parseAll에서 성공했다. `class A` 선언 뒤 `A --> Missing`도 DSL 파싱에 성공한다. 캔버스는 없는 endpoint의 관계선을 return null로 숨긴다. 타입 형태 검증이 의미적 참조 무결성을 보장하지 못한다. 트리/diagramIndex/diagrams 간 일관성 검증도 없다.

조치: 공통 의미 검증기로 ID 유일성, endpoint 존재, diagram 유형별 허용 요소/관계, 트리·인덱스 일치, 지원 버전을 검사한다. 미지원 미래 버전은 거부하고 이전 버전은 명시적 마이그레이션을 거친다.

### F5 [P1] 브라우저 다운로드 시작을 저장 성공으로 처리 — 코드 확인

위치: src/App.tsx:407, src/engine/browserProjectFile.ts:2.

downloadProject는 anchor 클릭 직후 반환한다. App은 다운로드 성공 여부와 무관하게 markSaved를 호출하므로, 다운로드가 취소·차단돼도 dirty가 해제되고 페이지 이탈 보호가 사라진다. 네이티브 저장 경로에는 동일한 완료 판정 문제가 없다.

조치: 다운로드 요청과 저장 완료를 구분한다. 브라우저 저장 완료를 확인할 수 없는 경우 복구 초안과 경고를 유지하거나, 쓰기 완료를 확인할 수 있는 지원 브라우저 파일 API를 제공한다.

## 보안·운영 출시 조건

### F6 [P1] Electron 파일 접근 경계 보강 필요 — 코드 확인, 공격 재현 아님

위치: electron/fileIO.ts:41, electron/preload.ts:24, electron/main.ts:9, index.html:3.

contextIsolation=true/nodeIntegration=false는 적절하다. 그러나 renderer가 넘긴 임의 경로를 읽고 쓰는 IPC가 senderFrame/origin, 승인 경로, payload 크기를 검증하지 않는다. CSP, 탐색·새 창 제한도 없다. 이것만으로 현재 XSS가 있다는 뜻은 아니지만 renderer 침해 시 파일 접근 피해를 제한하는 경계가 부족하다.

조치: 신뢰할 수 있는 sender와 main frame 검증, main 프로세스에서 승인한 문서 핸들만 사용, 데이터 크기 제한, CSP 및 탐색 정책을 추가한다. 런타임 Peggy 생성도 사전 컴파일해 엄격한 CSP와 충돌하지 않도록 한다.

근거: https://www.electronjs.org/docs/latest/tutorial/security

### F7 [P1] 의존성 보안 업데이트 및 영향 분석 필요 — npm audit 확인

현재 lockfile의 Electron 41.2.0이 high 항목으로 보고된다. Electron은 devDependency로 선언돼 있어도 배포 앱 런타임이다. Monaco 0.55.1과 DOMPurify 3.2.7은 production dependency 경로에 포함된다. critical인 tar는 개발 도구 전이 의존성이다. 개발 도구의 Windows 서버/빌드 경로 관련 항목을 macOS 오프라인 앱의 원격 공격 취약점으로 단정하지 않는다.

조치: 도달 가능한 공격 경로별 분류와 버전 업데이트, 회귀 테스트, 배포 산출물 재감사. 무조건 npm audit fix --force를 실행하지 않는다.

## 추가 소프트웨어 공학적 부족

- 복구: beforeunload는 강제 종료·크래시를 막지 못한다. 자동 복구 초안, crash recovery, 저장 충돌 감지/파일 잠금이 없다. atomic rename은 부분 쓰기를 줄이지만 fsync/백업/외부 변경 보호까지 제공하지 않는다.
- 스냅샷: localStorage 전체 프로젝트 복사이며 크기/보존 정책이 없다. createdAt+name으로 식별하므로 복제 프로젝트가 이력을 공유할 수 있다. VersionManager.loadIndex는 손상된 인덱스를 빈 목록으로 처리한다. durable 저장과 손상 복구·오류 구분이 필요하다.
- 아키텍처: ProjectSession 분리는 좋지만 App이 세션·Zustand·React 상태를 수동 동기화한다. 프로젝트 트리/인덱스/모델/DSL의 여러 표현을 검증하는 중앙 도메인 계층과 명령 트랜잭션이 필요하다.
- 성능: 변경마다 전체 모델 JSON deep clone, batch의 하위 명령마다 다시 clone, undo에 전체 스냅샷 저장. 파싱도 renderer에서 동기 실행한다. 문서 크기 제한과 대표 대형 문서에 대한 지연·메모리 측정 없이 대규모 지원을 주장할 수 없다.
- 테스트: 현재 284개는 모두 node 환경이다. 이 검토의 4개 엔진 재현이 기존 테스트를 통과한 코드에서 발생했다. UI/IPC/실제 저장·재열기, 실패 주입(용량 부족·권한·손상 파일), OS별 패키지 E2E가 필요하다. .github CI는 없으며 다른 외부 CI의 존재는 확인하지 못했다.
- 배포: ad-hoc macOS 서명이며 공증/업데이트/롤백/의존성 라이선스 고지 점검이 완료되지 않았다. 엄격한 TypeScript와 빌드 성공만으로 이 항목들이 대체되지 않는다.

## 상용 승인 기준 제안

1. F1–F5 회귀 재현을 테스트로 추가한 뒤 모든 지원 유형의 의미 보존과 오류 거부를 통과시킨다.
2. F6–F7 보안 경계를 적용하고 실제 배포 런타임 및 빌드 체인의 취약점 영향을 정리한다.
3. 저장→종료→재실행→열기, 복원, 내보내기, 강제 종료 복구, 외부 파일 변경 충돌을 실제 패키지 E2E에서 통과시킨다.
4. 지원 OS·최대 문서 크기·성능 기준을 선언하고 CI, 서명·공증, 릴리스·롤백 절차를 갖춘다.

판정은 상용 출시 보류다. 스펙 주도 개발은 이보다 추가로 요구사항 추적, 계약 검증, 구현과 명세의 불일치 검출이 필요하다. 먼저 다이어그램 명세 자체의 무손실성을 확보해야 한다.
