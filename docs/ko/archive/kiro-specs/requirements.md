# 요구사항 문서

> **Archived, Korean only.** This initial spec is superseded by the English [product specification](../../../product-spec.md) and is not maintained or translated. 초기 기록으로만 보존하며, 현재 기준은 영문 제품 기획안입니다.

## 소개

UML 데스크탑 클라이언트는 소프트웨어 개발자와 아키텍트가 UML 다이어그램을 생성, 편집, 저장, 내보내기할 수 있는 크로스 플랫폼 데스크탑 애플리케이션이다. 모든 프로젝트 데이터와 버전 관리 이력은 로컬 파일 시스템에 저장되며, 클라우드 저장소나 온라인 협업 기능은 현재 스코프에 포함되지 않는다. 클래스 다이어그램, 시퀀스 다이어그램, 유스케이스 다이어그램 등 주요 UML 다이어그램 유형을 지원하며, 직관적인 GUI 기반 편집 환경과 텍스트 기반 DSL 편집 환경을 동시에 제공하는 하이브리드 방식을 채택한다. DSL 텍스트 파일 기반 구조를 채택하여 외부 AI 도구가 파일 시스템에 접근하여 DSL 문법에 맞게 파일을 생성하거나 수정할 수 있으며, 앱 내에 AI 기능을 직접 내장하지 않는다. 대규모 프로젝트를 위한 트리 구조 기반 다이어그램 관리, 요소 참조 공유, 지연 로딩, 로컬 버전 관리를 지원하여 수십 개 이상의 다이어그램이 포함된 프로젝트에서도 효율적인 작업이 가능하다. 텍스트 편집기와 Canvas 간 실시간 양방향 동기화를 통해 텍스트 DSL과 시각적 편집을 자유롭게 전환하며 작업할 수 있다.

## 용어집

- **UML_Client**: UML 다이어그램을 생성하고 편집하는 데스크탑 애플리케이션
- **Canvas**: 다이어그램 요소를 배치하고 편집하는 작업 영역
- **Diagram_Element**: 다이어그램을 구성하는 개별 시각적 요소 (클래스, 액터, 노트 등)
- **Connector**: 두 Diagram_Element 사이의 관계를 나타내는 선 (연관, 상속, 의존 등)
- **Toolbar**: 다이어그램 요소와 도구를 선택할 수 있는 도구 모음 패널
- **Project_File**: UML 다이어그램 데이터를 저장하는 파일 형식
- **Parser**: Project_File을 읽어 내부 데이터 구조로 변환하는 모듈
- **Pretty_Printer**: 내부 데이터 구조를 Project_File 형식으로 변환하는 모듈
- **Export_Engine**: 다이어그램을 이미지 또는 문서 형식으로 변환하는 모듈
- **Property_Panel**: 선택된 Diagram_Element의 속성을 표시하고 편집하는 패널
- **Project_Tree**: 프로젝트 내 폴더, 패키지, 다이어그램을 계층적 트리 구조로 표시하는 탐색 패널
- **Diagram_Tab**: 열려 있는 다이어그램을 탭 형태로 전환할 수 있는 UI 요소
- **Shared_Element**: 여러 다이어그램에서 참조되는 단일 Diagram_Element 인스턴스
- **Lazy_Loader**: 프로젝트 데이터를 필요 시점에 점진적으로 로드하는 모듈
- **Text_Editor**: UML DSL 텍스트를 작성하고 편집할 수 있는 코드 편집기 컴포넌트
- **DSL**: UML 다이어그램을 텍스트로 정의하기 위한 도메인 특화 언어 (Domain-Specific Language)
- **DSL_Parser**: DSL 텍스트를 읽어 내부 다이어그램 데이터 구조로 변환하는 모듈
- **DSL_Serializer**: 내부 다이어그램 데이터 구조를 DSL 텍스트로 변환하는 모듈
- **Split_View**: Text_Editor와 Canvas를 나란히 표시하는 분할 화면 레이아웃
- **Sync_Engine**: Text_Editor와 Canvas 간 변경 사항을 실시간으로 양방향 동기화하는 모듈
- **Version_Manager**: 프로젝트의 변경 이력을 관리하고 스냅샷 생성, 되돌리기, 차이점 비교 기능을 제공하는 모듈
- **Snapshot**: 특정 시점의 프로젝트 전체 상태를 저장한 버전 단위
- **Version_History**: 프로젝트에 대해 생성된 모든 Snapshot의 시간순 목록
- **Diff_Viewer**: 두 Snapshot 간의 변경 사항을 시각적으로 비교하여 표시하는 UI 컴포넌트

## 요구사항

### 요구사항 1: 프로젝트 생성 및 관리

**사용자 스토리:** 개발자로서, 새 UML 프로젝트를 생성하고 관리할 수 있기를 원한다. 이를 통해 다이어그램 작업을 체계적으로 구성할 수 있다.

#### 인수 조건

1. WHEN 사용자가 새 프로젝트 생성을 요청하면, THE UML_Client SHALL 빈 Canvas가 포함된 새 프로젝트를 생성한다
2. WHEN 사용자가 프로젝트 저장을 요청하면, THE UML_Client SHALL 현재 프로젝트 상태를 Project_File 형식으로 로컬 파일 시스템에 저장한다
3. WHEN 사용자가 기존 Project_File을 열기 요청하면, THE Parser SHALL Project_File을 읽어 다이어그램 데이터를 Canvas에 복원한다
4. IF 사용자가 저장하지 않은 변경사항이 있는 상태에서 프로젝트를 닫으려 하면, THEN THE UML_Client SHALL 저장 여부를 확인하는 대화 상자를 표시한다
5. WHEN 사용자가 최근 프로젝트 목록을 요청하면, THE UML_Client SHALL 최근에 열었던 프로젝트 파일 경로를 최대 10개까지 표시한다

### 요구사항 2: 다이어그램 유형 지원

**사용자 스토리:** 소프트웨어 아키텍트로서, 다양한 UML 다이어그램 유형을 생성할 수 있기를 원한다. 이를 통해 시스템의 여러 측면을 모델링할 수 있다.

#### 인수 조건

1. THE UML_Client SHALL 클래스 다이어그램 생성을 지원한다
2. THE UML_Client SHALL 시퀀스 다이어그램 생성을 지원한다
3. THE UML_Client SHALL 유스케이스 다이어그램 생성을 지원한다
4. THE UML_Client SHALL 액티비티 다이어그램 생성을 지원한다
5. THE UML_Client SHALL 상태 다이어그램 생성을 지원한다
6. WHEN 사용자가 새 다이어그램 추가를 요청하면, THE UML_Client SHALL 지원하는 다이어그램 유형 목록을 표시하고 선택을 허용한다
7. WHEN 다이어그램 유형이 선택되면, THE Toolbar SHALL 해당 다이어그램 유형에 적합한 Diagram_Element 도구를 표시한다

### 요구사항 3: 다이어그램 요소 편집

**사용자 스토리:** 개발자로서, 다이어그램 요소를 직관적으로 추가, 이동, 수정, 삭제할 수 있기를 원한다. 이를 통해 효율적으로 다이어그램을 작성할 수 있다.

#### 인수 조건

1. WHEN 사용자가 Toolbar에서 Diagram_Element를 선택하고 Canvas를 클릭하면, THE UML_Client SHALL 클릭한 위치에 해당 Diagram_Element를 배치한다
2. WHEN 사용자가 Canvas 위의 Diagram_Element를 드래그하면, THE UML_Client SHALL Diagram_Element를 드래그한 위치로 이동한다
3. WHEN 사용자가 Diagram_Element를 더블클릭하면, THE Property_Panel SHALL 해당 Diagram_Element의 편집 가능한 속성을 표시한다
4. WHEN 사용자가 Diagram_Element를 선택하고 삭제를 요청하면, THE UML_Client SHALL 해당 Diagram_Element와 연결된 모든 Connector를 Canvas에서 제거한다
5. WHEN 사용자가 Diagram_Element의 크기 조절 핸들을 드래그하면, THE UML_Client SHALL Diagram_Element의 크기를 드래그 방향에 따라 조절한다
6. WHEN 사용자가 두 Diagram_Element 사이에 Connector 생성을 요청하면, THE UML_Client SHALL 선택된 관계 유형의 Connector를 두 요소 사이에 생성한다
7. WHEN Diagram_Element가 이동되면, THE UML_Client SHALL 해당 요소에 연결된 모든 Connector의 경로를 자동으로 재계산한다

### 요구사항 4: 실행 취소 및 다시 실행

**사용자 스토리:** 개발자로서, 편집 작업을 실행 취소하고 다시 실행할 수 있기를 원한다. 이를 통해 실수를 쉽게 되돌릴 수 있다.

#### 인수 조건

1. WHEN 사용자가 실행 취소를 요청하면, THE UML_Client SHALL 가장 최근의 편집 작업을 되돌린다
2. WHEN 사용자가 다시 실행을 요청하면, THE UML_Client SHALL 가장 최근에 취소된 편집 작업을 다시 적용한다
3. THE UML_Client SHALL 최소 50단계의 실행 취소 이력을 유지한다
4. WHEN 사용자가 실행 취소 후 새로운 편집 작업을 수행하면, THE UML_Client SHALL 다시 실행 이력을 초기화한다

### 요구사항 5: 내보내기 기능

**사용자 스토리:** 개발자로서, 다이어그램을 다양한 이미지 및 문서 형식으로 내보낼 수 있기를 원한다. 이를 통해 문서화 및 공유에 활용할 수 있다.

#### 인수 조건

1. WHEN 사용자가 PNG 내보내기를 요청하면, THE Export_Engine SHALL 현재 다이어그램을 PNG 이미지 파일로 변환하여 저장한다
2. WHEN 사용자가 SVG 내보내기를 요청하면, THE Export_Engine SHALL 현재 다이어그램을 SVG 벡터 파일로 변환하여 저장한다
3. WHEN 사용자가 PDF 내보내기를 요청하면, THE Export_Engine SHALL 현재 다이어그램을 PDF 문서로 변환하여 저장한다
4. WHEN 내보내기를 요청하면, THE UML_Client SHALL 파일 저장 위치와 파일명을 지정할 수 있는 대화 상자를 표시한다
5. IF 내보내기 중 오류가 발생하면, THEN THE Export_Engine SHALL 오류 원인을 포함한 메시지를 사용자에게 표시한다

### 요구사항 6: 프로젝트 파일 파싱 및 직렬화

**사용자 스토리:** 개발자로서, 프로젝트 파일이 안정적으로 저장되고 복원되기를 원한다. 이를 통해 대규모 프로젝트에서도 작업 데이터의 무결성을 보장할 수 있다.

#### 인수 조건

1. WHEN Project_File이 제공되면, THE Parser SHALL Project_File을 내부 다이어그램 데이터 구조로 변환한다
2. THE Pretty_Printer SHALL 내부 다이어그램 데이터 구조를 유효한 Project_File 형식으로 변환한다
3. IF 유효하지 않은 Project_File이 제공되면, THEN THE Parser SHALL 오류 위치와 원인을 포함한 설명적 오류 메시지를 반환한다
4. FOR ALL 유효한 다이어그램 데이터 구조에 대해, 파싱 후 출력 후 다시 파싱하면 동일한 데이터 구조를 생성한다 (라운드트립 속성)
5. WHEN 대규모 Project_File(다이어그램 50개 이상)이 제공되면, THE Parser SHALL 프로젝트 메타데이터와 트리 구조를 우선 파싱하고 개별 다이어그램 데이터는 요청 시 파싱한다
6. WHEN 프로젝트 저장을 요청하면, THE Pretty_Printer SHALL Shared_Element의 참조 관계를 보존하여 Project_File에 직렬화한다
7. WHEN Shared_Element가 포함된 Project_File을 파싱하면, THE Parser SHALL 동일한 Shared_Element를 참조하는 모든 다이어그램에서 단일 인스턴스로 복원한다

### 요구사항 7: Canvas 탐색 및 확대/축소

**사용자 스토리:** 개발자로서, 대규모 다이어그램을 효율적으로 탐색하고 확대/축소할 수 있기를 원한다. 이를 통해 복잡한 다이어그램도 편리하게 작업할 수 있다.

#### 인수 조건

1. WHEN 사용자가 마우스 휠을 스크롤하면, THE Canvas SHALL 확대 또는 축소를 수행한다
2. THE Canvas SHALL 25%에서 400% 사이의 확대/축소 범위를 지원한다
3. WHEN 사용자가 Canvas의 빈 영역을 드래그하면, THE Canvas SHALL 드래그 방향으로 뷰포트를 이동한다
4. WHEN 사용자가 전체 보기를 요청하면, THE Canvas SHALL 모든 Diagram_Element가 화면에 보이도록 확대/축소 수준과 위치를 자동 조정한다

### 요구사항 8: 클립보드 지원

**사용자 스토리:** 개발자로서, 다이어그램 요소를 복사, 잘라내기, 붙여넣기할 수 있기를 원한다. 이를 통해 반복적인 요소 생성 작업을 줄일 수 있다.

#### 인수 조건

1. WHEN 사용자가 Diagram_Element를 선택하고 복사를 요청하면, THE UML_Client SHALL 선택된 요소의 데이터를 클립보드에 저장한다
2. WHEN 사용자가 붙여넣기를 요청하면, THE UML_Client SHALL 클립보드의 Diagram_Element 데이터를 Canvas의 현재 마우스 위치에 새 요소로 생성한다
3. WHEN 사용자가 잘라내기를 요청하면, THE UML_Client SHALL 선택된 요소를 클립보드에 저장하고 Canvas에서 제거한다
4. WHEN 여러 Diagram_Element가 선택된 상태에서 복사를 요청하면, THE UML_Client SHALL 선택된 모든 요소와 요소 간 Connector를 함께 클립보드에 저장한다

### 요구사항 9: 프로젝트 트리 구조 관리

**사용자 스토리:** 소프트웨어 아키텍트로서, 프로젝트 내 다이어그램을 폴더와 패키지 구조로 계층적으로 관리할 수 있기를 원한다. 이를 통해 대규모 프로젝트에서도 다이어그램을 체계적으로 구성할 수 있다.

#### 인수 조건

1. THE Project_Tree SHALL 프로젝트 내 모든 폴더, 패키지, 다이어그램을 계층적 트리 구조로 표시한다
2. WHEN 사용자가 Project_Tree에서 새 폴더 생성을 요청하면, THE UML_Client SHALL 선택된 위치에 새 폴더를 생성한다
3. WHEN 사용자가 Project_Tree에서 다이어그램을 다른 폴더로 드래그하면, THE UML_Client SHALL 해당 다이어그램을 대상 폴더로 이동한다
4. WHEN 사용자가 Project_Tree에서 폴더 또는 다이어그램의 이름 변경을 요청하면, THE UML_Client SHALL 인라인 편집을 통해 이름 변경을 허용한다
5. WHEN 사용자가 Project_Tree에서 폴더 삭제를 요청하면, THE UML_Client SHALL 해당 폴더와 하위 항목 삭제 여부를 확인하는 대화 상자를 표시한다
6. THE Project_Tree SHALL 폴더의 펼침 및 접힘 상태를 프로젝트 세션 동안 유지한다

### 요구사항 10: 다이어그램 탭 전환

**사용자 스토리:** 개발자로서, 열려 있는 여러 다이어그램을 탭으로 빠르게 전환할 수 있기를 원한다. 이를 통해 여러 다이어그램을 동시에 작업할 때 효율성을 높일 수 있다.

#### 인수 조건

1. WHEN 사용자가 Project_Tree에서 다이어그램을 더블클릭하면, THE UML_Client SHALL 해당 다이어그램을 새 Diagram_Tab으로 열고 Canvas에 표시한다
2. WHEN 사용자가 Diagram_Tab을 클릭하면, THE UML_Client SHALL 해당 다이어그램을 Canvas에 활성화하여 표시한다
3. WHEN 사용자가 Diagram_Tab의 닫기 버튼을 클릭하면, THE UML_Client SHALL 해당 탭을 닫고 다음 탭을 활성화한다
4. IF 사용자가 저장하지 않은 변경사항이 있는 Diagram_Tab을 닫으려 하면, THEN THE UML_Client SHALL 저장 여부를 확인하는 대화 상자를 표시한다
5. THE UML_Client SHALL 각 Diagram_Tab에 다이어그램 이름과 수정 여부 표시자를 표시한다
6. WHEN 이미 열려 있는 다이어그램을 Project_Tree에서 더블클릭하면, THE UML_Client SHALL 새 탭을 생성하지 않고 기존 Diagram_Tab을 활성화한다

### 요구사항 11: 요소 참조 공유

**사용자 스토리:** 소프트웨어 아키텍트로서, 하나의 클래스나 요소를 여러 다이어그램에서 참조하여 사용할 수 있기를 원한다. 이를 통해 한 곳에서 수정하면 모든 다이어그램에 자동으로 반영되어 일관성을 유지할 수 있다.

#### 인수 조건

1. WHEN 사용자가 기존 Diagram_Element를 다른 다이어그램에 참조로 추가하면, THE UML_Client SHALL 원본과 동일한 Shared_Element 인스턴스를 해당 다이어그램의 Canvas에 배치한다
2. WHEN 사용자가 Shared_Element의 속성(이름, 필드, 메서드 등)을 수정하면, THE UML_Client SHALL 해당 Shared_Element를 참조하는 모든 다이어그램에서 변경 사항을 즉시 반영한다
3. WHEN 사용자가 Shared_Element를 특정 다이어그램에서 제거하면, THE UML_Client SHALL 해당 다이어그램에서의 참조만 제거하고 원본 요소와 다른 다이어그램의 참조는 유지한다
4. WHEN 사용자가 Shared_Element를 선택하면, THE Property_Panel SHALL 해당 요소를 참조하는 다이어그램 목록을 표시한다
5. IF 사용자가 모든 다이어그램에서 참조되는 Shared_Element의 원본 삭제를 요청하면, THEN THE UML_Client SHALL 영향받는 다이어그램 목록을 표시하고 삭제 확인을 요청한다

### 요구사항 12: 대규모 프로젝트 지연 로딩

**사용자 스토리:** 개발자로서, 대규모 프로젝트를 열 때 필요한 데이터만 점진적으로 로드하기를 원한다. 이를 통해 프로젝트 열기 시간을 단축하고 메모리 사용을 최적화할 수 있다.

#### 인수 조건

1. WHEN 대규모 프로젝트(다이어그램 50개 이상)를 열면, THE Lazy_Loader SHALL 프로젝트 트리 구조와 메타데이터만 우선 로드한다
2. WHEN 사용자가 특정 다이어그램을 Diagram_Tab으로 열면, THE Lazy_Loader SHALL 해당 다이어그램의 전체 데이터를 로드한다
3. WHILE 다이어그램 데이터를 로드하는 중에, THE UML_Client SHALL 로딩 진행 상태를 사용자에게 표시한다
4. THE Lazy_Loader SHALL 로드된 다이어그램 데이터를 메모리에 캐시하여 재접근 시 추가 로드 없이 표시한다
5. WHEN 메모리 사용량이 설정된 임계값을 초과하면, THE Lazy_Loader SHALL 가장 오래 사용되지 않은 다이어그램 데이터를 메모리에서 해제한다
6. WHILE 다이어그램 데이터가 아직 로드되지 않은 상태에서, THE Project_Tree SHALL 해당 다이어그램의 이름과 유형 정보를 표시한다

### 요구사항 13: 다이어그램 간 탐색

**사용자 스토리:** 개발자로서, Project_Tree를 통해 다이어그램 간 빠르게 탐색하고 원하는 다이어그램을 찾을 수 있기를 원한다. 이를 통해 대규모 프로젝트에서도 효율적으로 작업할 수 있다.

#### 인수 조건

1. WHEN 사용자가 Project_Tree에서 검색어를 입력하면, THE Project_Tree SHALL 다이어그램 이름과 요소 이름을 기준으로 일치하는 항목을 필터링하여 표시한다
2. WHEN 사용자가 Project_Tree의 검색 결과에서 항목을 선택하면, THE UML_Client SHALL 해당 다이어그램을 Diagram_Tab으로 열고 해당 요소를 Canvas 중앙에 표시한다
3. WHEN 사용자가 Canvas에서 Shared_Element를 우클릭하고 "참조 다이어그램으로 이동"을 선택하면, THE UML_Client SHALL 해당 요소가 포함된 다이어그램 목록을 표시하고 선택된 다이어그램으로 이동한다
4. WHEN 사용자가 Project_Tree에서 폴더를 선택하면, THE Project_Tree SHALL 해당 폴더의 하위 다이어그램 개수를 표시한다
5. THE Project_Tree SHALL 현재 활성화된 Diagram_Tab에 해당하는 항목을 시각적으로 강조 표시한다

### 요구사항 14: 텍스트 기반 UML 정의

**사용자 스토리:** 개발자로서, 텍스트 DSL을 사용하여 UML 다이어그램을 정의할 수 있기를 원한다. 이를 통해 키보드 중심의 빠른 다이어그램 작성과 버전 관리 시스템과의 호환성을 확보할 수 있다.

#### 인수 조건

1. THE Text_Editor SHALL DSL 문법에 따른 구문 강조(syntax highlighting)를 지원한다
2. THE DSL SHALL 클래스 다이어그램, 시퀀스 다이어그램, 유스케이스 다이어그램, 액티비티 다이어그램, 상태 다이어그램의 정의를 지원한다
3. WHEN 사용자가 Text_Editor에 유효한 DSL 텍스트를 입력하면, THE DSL_Parser SHALL DSL 텍스트를 내부 다이어그램 데이터 구조로 변환한다
4. THE DSL_Serializer SHALL 내부 다이어그램 데이터 구조를 유효한 DSL 텍스트로 변환한다
5. IF 사용자가 유효하지 않은 DSL 텍스트를 입력하면, THEN THE DSL_Parser SHALL 오류 위치(행, 열)와 원인을 포함한 설명적 오류 메시지를 Text_Editor에 표시한다
6. FOR ALL 유효한 다이어그램 데이터 구조에 대해, DSL 직렬화 후 파싱하면 동일한 데이터 구조를 생성한다 (라운드트립 속성)
7. THE Text_Editor SHALL DSL 키워드 및 요소 이름에 대한 자동 완성 기능을 제공한다
8. THE Text_Editor SHALL 행 번호 표시를 지원한다

### 요구사항 15: 텍스트 편집기와 Canvas 실시간 양방향 동기화

**사용자 스토리:** 개발자로서, Text_Editor에서 DSL 텍스트를 수정하면 Canvas에 즉시 반영되고, Canvas에서 GUI로 수정하면 Text_Editor에 즉시 반영되기를 원한다. 이를 통해 텍스트와 시각적 편집을 자유롭게 전환하며 작업할 수 있다.

#### 인수 조건

1. WHEN 사용자가 Text_Editor에서 DSL 텍스트를 수정하면, THE Sync_Engine SHALL 변경 사항을 Canvas에 실시간으로 반영한다
2. WHEN 사용자가 Canvas에서 Diagram_Element를 추가, 이동, 수정, 삭제하면, THE Sync_Engine SHALL 변경 사항을 Text_Editor의 DSL 텍스트에 실시간으로 반영한다
3. WHILE Sync_Engine이 동기화를 수행하는 동안, THE UML_Client SHALL Text_Editor와 Canvas 모두에서 사용자 입력을 차단하지 않는다
4. IF Text_Editor의 DSL 텍스트에 구문 오류가 포함되어 있으면, THEN THE Sync_Engine SHALL 마지막으로 유효했던 다이어그램 상태를 Canvas에 유지하고 오류 위치를 Text_Editor에 표시한다
5. WHEN Canvas에서 Diagram_Element의 위치가 변경되면, THE Sync_Engine SHALL DSL 텍스트 내 해당 요소의 레이아웃 정보를 업데이트한다
6. WHEN Canvas에서 Connector가 추가 또는 삭제되면, THE Sync_Engine SHALL DSL 텍스트에 해당 관계 정의를 추가 또는 삭제한다
7. THE Sync_Engine SHALL Text_Editor와 Canvas 간 동기화 시 실행 취소 이력을 통합하여 관리한다

### 요구사항 16: 외부 생성 DSL 텍스트 붙여넣기를 통한 다이어그램 자동 생성

**사용자 스토리:** 개발자로서, 외부 AI 도구 또는 다른 소스에서 생성한 DSL 텍스트를 Text_Editor에 붙여넣으면 다이어그램이 자동으로 생성되기를 원한다. 이를 통해 외부 AI 도구(ChatGPT, Copilot 등)가 DSL 문법에 맞게 생성한 텍스트를 복사하여 붙여넣는 방식으로 다이어그램 작성 속도를 높일 수 있다. 앱 내에 AI 에이전트를 내장하지 않으며, 외부에서 생성된 텍스트를 붙여넣는 시나리오를 지원한다.

#### 인수 조건

1. WHEN 사용자가 DSL 형식의 텍스트를 Text_Editor에 붙여넣으면, THE DSL_Parser SHALL 붙여넣은 텍스트를 파싱하여 다이어그램 데이터 구조로 변환한다
2. WHEN DSL 텍스트 붙여넣기가 성공적으로 파싱되면, THE Sync_Engine SHALL Canvas에 해당 다이어그램을 자동으로 렌더링한다
3. IF 붙여넣은 텍스트가 유효하지 않은 DSL 형식이면, THEN THE DSL_Parser SHALL 오류 위치와 원인을 Text_Editor에 표시하고 붙여넣기 이전 상태를 유지한다
4. WHEN 대량의 DSL 텍스트(요소 100개 이상)가 붙여넣어지면, THE UML_Client SHALL 파싱 및 렌더링 진행 상태를 사용자에게 표시한다
5. WHEN 붙여넣은 DSL 텍스트에 기존 다이어그램과 중복되는 요소 이름이 포함되면, THE UML_Client SHALL 중복 요소에 대한 처리 방법(덮어쓰기, 이름 변경, 건너뛰기)을 사용자에게 확인한다

### 요구사항 17: Canvas에서 직접 수정

**사용자 스토리:** 개발자로서, Canvas GUI에서 다이어그램 요소의 배치, 속성, 스타일을 직접 수정할 수 있기를 원한다. 이를 통해 텍스트 편집 없이도 시각적으로 세밀한 조정이 가능하다.

#### 인수 조건

1. WHEN 사용자가 Canvas에서 Diagram_Element를 드래그하여 위치를 변경하면, THE UML_Client SHALL 변경된 위치를 다이어그램 데이터에 즉시 반영한다
2. WHEN 사용자가 Canvas에서 Diagram_Element를 더블클릭하면, THE Property_Panel SHALL 해당 요소의 이름, 속성, 메서드 등 편집 가능한 필드를 표시한다
3. WHEN 사용자가 Property_Panel에서 Diagram_Element의 속성을 변경하면, THE UML_Client SHALL 변경 사항을 Canvas와 Text_Editor에 즉시 반영한다
4. WHEN 사용자가 Canvas에서 여러 Diagram_Element를 선택하고 정렬을 요청하면, THE UML_Client SHALL 선택된 요소를 지정된 정렬 기준(좌측, 중앙, 우측, 상단, 중간, 하단)에 따라 정렬한다
5. WHEN 사용자가 Canvas에서 여러 Diagram_Element를 선택하고 균등 배분을 요청하면, THE UML_Client SHALL 선택된 요소 간 간격을 균등하게 조정한다
6. WHEN 사용자가 Canvas에서 Connector의 경유점을 드래그하면, THE UML_Client SHALL Connector의 경로를 사용자가 지정한 경유점을 따르도록 변경한다

### 요구사항 18: 분할 뷰

**사용자 스토리:** 개발자로서, Text_Editor와 Canvas를 나란히 볼 수 있는 분할 뷰를 사용하기를 원한다. 이를 통해 텍스트 편집과 시각적 결과를 동시에 확인하며 작업할 수 있다.

#### 인수 조건

1. THE UML_Client SHALL Text_Editor와 Canvas를 좌우로 나란히 표시하는 Split_View 모드를 제공한다
2. WHEN 사용자가 Split_View 모드를 활성화하면, THE UML_Client SHALL Text_Editor를 좌측에, Canvas를 우측에 배치하여 표시한다
3. WHEN 사용자가 Split_View의 구분선을 드래그하면, THE UML_Client SHALL Text_Editor와 Canvas의 너비 비율을 드래그 위치에 따라 조정한다
4. THE UML_Client SHALL Canvas 전용 모드, Text_Editor 전용 모드, Split_View 모드 간 전환 기능을 제공한다
5. WHEN 사용자가 뷰 모드를 전환하면, THE UML_Client SHALL 현재 편집 중인 다이어그램의 상태를 유지한 채 레이아웃을 변경한다
6. THE UML_Client SHALL 사용자가 마지막으로 선택한 뷰 모드와 Split_View 구분선 위치를 프로젝트 세션 동안 유지한다


### 요구사항 19: 로컬 버전 관리

**사용자 스토리:** 개발자로서, 프로젝트와 다이어그램의 변경 이력을 로컬에서 관리하고 이전 버전으로 되돌릴 수 있기를 원한다. 이를 통해 실험적인 변경을 안전하게 시도하고 필요 시 이전 상태로 복원할 수 있다.

#### 인수 조건

1. WHEN 사용자가 스냅샷 생성을 요청하면, THE Version_Manager SHALL 현재 프로젝트 상태를 Snapshot으로 로컬 파일 시스템에 저장한다
2. WHEN 사용자가 스냅샷 생성을 요청하면, THE UML_Client SHALL 스냅샷에 대한 설명 메시지를 입력할 수 있는 대화 상자를 표시한다
3. THE Version_Manager SHALL 각 Snapshot에 생성 시각, 설명 메시지, 고유 식별자를 기록한다
4. WHEN 사용자가 버전 이력 조회를 요청하면, THE UML_Client SHALL Version_History를 시간순으로 표시하며 각 Snapshot의 생성 시각과 설명 메시지를 포함한다
5. WHEN 사용자가 특정 Snapshot으로 되돌리기를 요청하면, THE Version_Manager SHALL 현재 프로젝트 상태를 해당 Snapshot의 상태로 복원한다
6. IF 사용자가 저장하지 않은 변경사항이 있는 상태에서 되돌리기를 요청하면, THEN THE UML_Client SHALL 현재 변경사항이 손실될 수 있음을 알리고 진행 여부를 확인하는 대화 상자를 표시한다
7. WHEN 사용자가 두 Snapshot 간 차이점 비교를 요청하면, THE Diff_Viewer SHALL 두 버전 간 추가, 수정, 삭제된 다이어그램 요소와 DSL 텍스트 변경 사항을 표시한다
8. THE Version_Manager SHALL 모든 Snapshot 데이터를 로컬 파일 시스템에 저장한다
9. WHEN 사용자가 특정 Snapshot의 삭제를 요청하면, THE Version_Manager SHALL 해당 Snapshot을 Version_History에서 제거하고 관련 데이터를 로컬 파일 시스템에서 삭제한다
10. IF 프로젝트에 Snapshot이 존재하지 않는 상태에서 되돌리기를 요청하면, THEN THE UML_Client SHALL 사용 가능한 스냅샷이 없음을 알리는 메시지를 표시한다
