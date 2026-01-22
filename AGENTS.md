# JINDO - Ollama-based MCP Agent

**Generated:** 2026-01-23
**Version:** 0.1.0

## OVERVIEW
Ollama 기반 로컬 모델 에이전트. MCP (Model Context Protocol) 완전 지원. 듀얼 모델 아키텍처로 conversation + function calling 분리. Free-tier 친화적.

## STRUCTURE
```
jindo/
├── src/
│   ├── interfaces/        # CLI, REPL, Web 추상화
│   ├── core/             # AgentController, ToolExecutor
│   ├── models/           # OllamaAdapter, FunctionGemma
│   ├── mcp/              # MCP 통합
│   ├── tools/            # 내장 도구 + MCP wrappers
│   ├── cli/              # CLI 명령어
│   ├── config/           # ConfigManager
│   ├── registry/         # MCP 레지스트리
│   └── utils/            # Logger, Errors
├── config/               # 기본 설정/프리셋
├── examples/             # 사용 예시
└── ~/.config/jindo/     # 사용자 설정 (런타임)
    ├── config.yaml
    ├── mcp-settings.json
    └── .env
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 에이전트 오케스트레이션 | `src/core/AgentController.ts` | 중앙 컨트롤러 |
| 모델 선택/폴백 | `src/models/ModelSelector.ts` | 듀얼 모델 자동 선택 |
| MCP 서버 관리 | `src/mcp/MCPRegistry.ts` | mcp-settings.json 사용 |
| CLI 진입점 | `src/index.ts` | Commander.js 기반 |
| 설정 관리 | `src/config/ConfigManager.ts` | ~/.config/jindo/ 경로 |

## CODE MAP
(프로젝트 초기 단계, 심볼 매핑 생략)

## CONVENTIONS

### 모델 명명
- `ollama:modelname:version` 형식 사용
- 예: `ollama:llama3.2:3b`, `ollama:functiongemma`

### MCP 서버
- 모든 MCP 서버는 `~/.config/jindo/mcp-settings.json`에 등록
- 환경변수는 `${VAR_NAME}` 형식으로 치환

### 설정 경로
- 기본: `~/.config/jindo/`
- 환경변수 `JINDO_CONFIG_PATH`로 오버라이드 가능

### 인터페이스 출력
- 기본: 플레인 텍스트
- 옵션: 마크다운 (`--format markdown`)

## ANTI-PATTERNS (THIS PROJECT)
- ❌ 단일 모델로 function calling 강제 → 듀얼 모델 사용
- ❌ 하드코딩된 모델 이름 → config.yaml로 관리
- ❌ MCP 서버 자동 다운로드 → 사용자 선택 필요
- ❌ 플레인 텍스트만 출력 → 마크다운 옵션 지원
- ❌ 로컬 모델 이름 헛갈림 → 실제 존재하는 모델만 (functiongemma:270m만 존재)

## UNIQUE STYLES

### 듀얼 모델 아키텍처
- **Conversation 모델**: 자연어 응답 (llama3.2:3b, phi-3-mini, llama3.1:8b)
- **Function 모델**: 도구 선택/파라미터 추출 (functiongemma:270m)
- 폴백: Function 모델 없으면 Conversation 모델 사용

### 모델 프리셋
| 프리셋 | Conversation | Function | VRAM | 디스크 |
|--------|-------------|-----------|------|--------|
| lightweight | phi-3-mini | functiongemma | 2.5GB | 1.7GB |
| balanced | llama3.2:3b | functiongemma | 3.5GB | 1.9GB |
| highend | llama3.1:8b | functiongemma | 10GB | 5.0GB |

### CLI 설계
- Commander.js + Inquirer.js
- 색상 지원 (chalk)
- 스트리밍 출력
- 툴 실행 상태 표시

## COMMANDS

### CLI 기본
```bash
jindo init                    # 초기 설정 (모델 선택)
jindo chat                    # 대화 모드
jindo chat --format markdown  # 마크다운 출력
jindo mcp list               # MCP 서버 목록
jindo mcp add brave-search   # MCP 서버 추가
jindo mcp enable server      # MCP 서버 활성화
jindo model list             # 로컬 모델 목록
jindo model download llama3.2:3b  # 모델 다운로드
jindo config get             # 설정 보기
jindo config set agent.conversation.model ollama:llama3.1:8b
```

### 개발
```bash
pnpm dev                     # 개발 모드 실행
pnpm build                   # 빌드
pnpm test                    # 테스트
pnpm lint                    # 린트
```

## NOTES

### Ollama 설치 필수
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows (WSL)
wsl --install
curl -fsSL https://ollama.com/install.sh | sh
```

### functiongemma 특이사항
- Ollama 0.13.5+ 필요
- 301MB만으로 function calling 가능 (functiongemma:270m)
- 대화용 모델 아님, function calling 전용
- 최종 파인튜닝 후 사용 권장 (기본 베이스 모델)

### MCP 레지스트리
- 현재: `config/builtin-servers.json` 내장
- Future: 별도 레지스트리 서버

### 디버그 모드
```bash
export DEBUG=1
jindo chat
```

### 설치 방법
```bash
# npm 전역 설치
npm install -g jindo

# pnpm 전역 설치
pnpm add -g jindo

# npx (설치 없이 체험)
npx jindo --help
```

---

## IMPLEMENTATION PHASES

### Phase 1: 프로젝트 셋업 (P0)
- [ ] package.json 작성
- [ ] tsconfig.json 설정
- [ ] 디렉토리 구조 생성
- [ ] ConfigManager 구현
- [ ] ~/.config/jindo/ 경로 설정

### Phase 2: Ollama 모델 통합 (P0)
- [ ] IModelProvider 인터페이스
- [ ] OllamaAdapter 구현
- [ ] FunctionGemmaAdapter 구현
- [ ] ModelSelector (자동 선택/폴백)
- [ ] builtin-models.yaml 작성

### Phase 3: 코어 기능 (P0)
- [ ] AgentController (메인 오케스트레이션)
- [ ] Conversation (대화 컨텍스트)
- [ ] Memory (장기 메모리)
- [ ] ToolExecutor (도구 실행)
- [ ] FunctionRouter (function call 라우팅)

### Phase 4: MCP 통합 (P0)
- [ ] MCPRegistry (서버 관리)
- [ ] MCPToolWrapper (도구 래퍼)
- [ ] mcp-settings.json 로드/저장
- [ ] MCP 연결/해제
- [ ] 환경변수 치환

### Phase 5: CLI (P0)
- [ ] IInterface 인터페이스
- [ ] CLIInterface 구현
- [ ] init command (모델 선택)
- [ ] chat command (대화 모드)
- [ ] mcp command (list, add, enable, disable)
- [ ] model command (list, download, set)
- [ ] config command (get, set)

### Phase 6: 내장 도구 (P1)
- [ ] BaseTool 기본 클래스
- [ ] FileSystem 도구
- [ ] Shell 도구
- [ ] WebSearch 도구 (선택)

### Phase 7: MCP 레지스트리 (P1)
- [ ] RegistryClient
- [ ] builtin-servers.json
- [ ] mcp add from-registry
- [ ] mcp search 기능

### Phase 8: 배포 (P1)
- [ ] npm 배포
- [ ] README.md 작성
- [ ] 사용 예시 작성
- [ ] Homebrew tap (옵션)
- [ ] pkg를 통한 실행파일 생성 (옵션)

---

## EXAMPLE USAGE

### 기본 대화
```bash
$ jindo init
$ jindo chat
> What's the weather in Seoul?

[🔧 calling: search({"query": "weather Seoul"})]
[✓ search completed]

The weather in Seoul is currently 15°C with clear skies.
```

### MCP 서버 추가
```bash
$ jindo mcp add brave-search
✓ Searching registry for "brave-search"
✓ Found: @modelcontextprotocol/server-brave-search
? Set BRAVE_API_KEY: [输入]

✓ Added MCP server: brave-search
```

### 모델 변경
```bash
$ jindo model set preset highend
✓ Set conversation model to: ollama:llama3.1:8b
✓ Set function model to: ollama:functiongemma

Restart chat to apply changes.
```
