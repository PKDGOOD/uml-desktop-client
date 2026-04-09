# UML Desktop Client

텍스트 DSL과 GUI Canvas를 실시간 양방향 동기화하는 하이브리드 UML 편집기.

## 주요 기능

- 5가지 UML 다이어그램: 클래스, 시퀀스, 유스케이스, 액티비티, 상태
- 텍스트 DSL ↔ Canvas 실시간 양방향 동기화
- Monaco Editor 기반 텍스트 편집 (구문 강조, 자동 완성)
- Konva.js 기반 Canvas (드래그, 줌, 패닝, 리사이즈)
- 프로젝트 트리 구조 관리 (폴더, 탭, 검색)
- 요소 참조 공유 (Shared Element)
- 로컬 버전 관리 (스냅샷, 복원, diff)
- PNG/SVG/PDF 내보내기
- Undo/Redo (50단계)
- 클립보드 (복사/잘라내기/붙여넣기)
- 대규모 프로젝트 지연 로딩 (LRU 캐시)
- 완전 오프라인 동작 (서버 불필요)

## 기술 스택

| 영역 | 기술 |
|------|------|
| 런타임 | Electron |
| UI | React + TypeScript |
| 빌드 | Vite |
| Canvas | Konva.js (react-konva) |
| 텍스트 편집기 | Monaco Editor |
| DSL 파서 | peggy (PEG.js) |
| 상태 관리 | Zustand |
| 테스트 | Vitest + fast-check |

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 (브라우저에서 확인)
npm run dev

# Electron 앱으로 실행 (별도 터미널)
npx electron .

# 테스트
npm test
```

## 프로젝트 구조

```
src/
├── types/           # 핵심 데이터 모델 타입
├── parser/
│   ├── dsl/         # DSL 파서 (peggy) + 직렬화기
│   └── project/     # 프로젝트 파일 JSON 파서/직렬화기
├── engine/          # 핵심 엔진
│   ├── syncEngine   # 텍스트 ↔ Canvas 양방향 동기화
│   ├── undoManager  # Undo/Redo (Command 패턴)
│   ├── clipboardManager
│   ├── sharedElementRegistry
│   ├── lazyLoader + lruCache
│   ├── versionManager
│   └── exportEngine
├── store/           # Zustand 스토어
├── components/      # React UI 컴포넌트
│   ├── canvas/      # Konva.js Canvas
│   ├── editor/      # Monaco Editor
│   ├── layout/      # SplitView
│   ├── toolbar/     # 다이어그램 유형별 도구 모음
│   ├── properties/  # 속성 패널
│   ├── project/     # 프로젝트 트리
│   └── tabs/        # 다이어그램 탭
└── App.tsx          # 메인 앱 컴포넌트
electron/
├── main.ts          # Electron 메인 프로세스
├── preload.ts       # IPC 브릿지
├── fileIO.ts        # 파일 I/O 핸들러
└── recentProjects.ts
```

## DSL 문법 예시

```
@class-diagram "주문 시스템"

class Order {
  - id: string
  - status: OrderStatus
  + addItem(item: OrderItem): void
  + calculateTotal(): number
}

class OrderItem {
  - quantity: number
  - unitPrice: number
}

Order "1" --> "*" OrderItem : contains
```

## 라이선스

MIT
