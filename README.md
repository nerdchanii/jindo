# Jindo - Ollama-based MCP Agent

**Generated:** 2026-01-25  
**Version:** 0.1.0

## Overview

Jindo는 Ollama 기반의 로컬 모델 에이전트로, MCP (Model Context Protocol)를 완전히 지원합니다. 듀얼 모델 아키텍처로 conversation + function calling을 분리하며, ink 기반 TUI와 멀티 프로바이더 지원을 통해 최고의 사용자 경험을 제공합니다.

## Features

- 🤖 **듀얼 모델 아키텍처**
  - Conversation 모델 (llama3.2:3b, phi-3-mini, llama3.1:8b)
  - Function 모델 (functiongemma:270m)
  - 자동 폴백: Function 모델 없으면 Conversation 모델 사용

- 🌐 **멀티 프로바이더 지원**
  - Ollama (로컬 모델)
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude)
  - Groq (빠른 추론)
  - 모델 접두사 자동 라우팅 (openai:gpt-4, anthropic:claude-3, etc.)

- 🎨 **ink TUI 인터페이스**
  - React 기반 터미널 UI
  - 자동완성 및 탭 완성
  - 키보드 내비게이션 (방향키, Tab, Esc)
  - 실시간 스트리밍 출력
  - 슬래시 명령어 지원

- 🔌 **MCP 완전 지원**
  - MCP 서버 동적 연결/해제
  - 도구 자동 등록 및 실행
  - 환경변수 치환 (`${API_KEY}`)
  - 내장 MCP 서버 레지스트리 지원 (향후)

- 🛠️ **내장 도구**
  - FileSystem 도구 (파일 읽기/쓰기)
  - Shell 도구 (명령어 실행)
  - Config 도구 (설정 관리)
  - Model 도구 (모델 정보 조회)

- ⚙️ **고급 프롬프트 관리**
  - 중앙 PromptManager로 시스템/함수콜 프롬프트 관리
  - 패키지 내장 + 사용자 오버라이드 우선순위
  - 버전 관리 및 Langfuse 확장 준비
  - 동적 프롬프트 로딩 및 캐싱

## Quick Start

### 1. 설치

```bash
# npm 전역 설치
npm install -g jindo

# pnpm 전역 설치
pnpm add -g jindo

# npx (설치 없이 체험)
npx jindo --help
```

### 2. Ollama 설치

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows (WSL)
wsl --install
curl -fsSL https://ollama.com/install.sh | sh
```

### 3. 초기 설정

```bash
jindo init
```

프리셋 선택:

- `lightweight` (2.5GB VRAM, 빠름)
- `balanced` (3.5GB VRAM, 권장)
- `highend` (10GB VRAM, 고성능)

### 4. 모델 설치

```bash
ollama pull llama3.2:3b     # Conversation 모델
ollama pull functiongemma:270m # Function 모델
```

### 5. 채팅 시작

```bash
jindo chat
```

## Commands

### `jindo init`

Jindo 설정 초기화

```bash
jindo init [--preset <preset>] [--force]
```

**옵션:**

- `-p, --preset <preset>`: 프리셋 선택 (lightweight, balanced, highend)
- `-f, --force`: 기존 설정 덮어쓰기

### `jindo chat`

인터랙티브 채팅 모드

```bash
jindo chat [-f <format>] [-v] [--no-streaming] [--tui]
```

**옵션:**

- `-f, --format <format>`: 출력 포맷 (text, markdown)
- `-v, --verbose`: 상세 출력
- `--no-streaming`: 스트리밍 비활성화
- `--tui`: ink 기반 TUI 인터페이스로 시작

### `jindo config`

설정 관리

```bash
jindo config get [path]    # 설정 값 조회
jindo config set <path> <value>  # 설정 값 설정
jindo config path          # 설정 파일 경로 표시
jindo config reset         # 설정 초기화
```

**예시:**

```bash
jindo config get agent.conversationModel
jindo config set agent.conversationModel ollama:llama3.1:8b
jindo config set agent.maxHistoryMessages 100
```

### `jindo model`

Ollama 모델 관리

```bash
jindo model list                 # 설치된/권장 모델 목록
jindo model download <model>      # 모델 다운로드
jindo model set <type> <value>   # 모델 설정
jindo model info <model>          # 모델 정보
```

**타입:**

- `preset`: 프리셋 (lightweight, balanced, highend)
- `conversation`: Conversation 모델
- `function`: Function 모델

### `jindo mcp`

MCP 서버 관리

```bash
jindo mcp list                       # 설정된 서버 목록
jindo mcp add <name> [-c <command>] [-a <args...>]  # 서버 추가
jindo mcp enable <name>             # 서버 활성화
jindo mcp disable <name>            # 서버 비활성화
jindo mcp remove <name>             # 서버 제거
```

## Configuration

### 설정 파일 위치

```
~/.config/jindo/
├── config.yaml           # 기본 설정
├── mcp-settings.json     # MCP 서버 설정
└── .env                 # 환경변수 (선택)
```

### 기본 설정 (config.yaml)

```yaml
agent:
  conversationModel: ollama:llama3.2:3b # 대화 모델
  functionModel: ollama:functiongemma:270m # 함수 호출 모델
  outputFormat: text # 출력 포맷
  maxHistoryMessages: 50 # 최대 히스토리 메시지

mcp:
  servers: {} # MCP 서버 설정
```

### MCP 서버 설정

```json
{
  "servers": {
    "brave-search": {
      "enabled": true,
      "command": "node",
      "args": ["./server.js"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      },
      "type": "custom"
    }
  }
}
```

### 프롬프트 관리

프롬프트는 다음 우선순위로 로드됩니다:

1. **사용자 오버라이드**: `~/.config/jindo/prompts/system.md`
2. **패키지 내장**: `node_modules/jindo/prompts/system.md`
3. **하드코딩 기본값**: 소스에 내장된 기본값

## Model Presets

| 프리셋      | Conversation 모델  | Function 모델             | VRAM  | 디스크 | 특징         |
| ----------- | ------------------ | ------------------------- | ----- | ------ | ------------ |
| lightweight | ollama:phi-3-mini  | ollama:functiongemma:270m | 2.5GB | 1.7GB  | 빠름, 저사양 |
| balanced    | ollama:llama3.2:3b | ollama:functiongemma:270m | 3.5GB | 1.9GB  | 권장         |
| highend     | ollama:llama3.1:8b | ollama:functiongemma:270m | 10GB  | 5.0GB  | 고성능       |

## Architecture

```
src/
├── core/                 # 코어 로직
│   ├── AgentController.ts
│   ├── Conversation.ts
│   ├── Memory.ts
│   ├── ToolExecutor.ts
│   └── FunctionRouter.ts
├── models/               # 모델 어댑터
│   ├── OllamaAdapter.ts
│   ├── FunctionGemmaAdapter.ts
│   └── ModelSelector.ts
├── mcp/                  # MCP 통합
│   ├── MCPRegistry.ts
│   ├── MCPToolWrapper.ts
│   ├── MCPService.ts
│   └── EnvSubstitution.ts
├── tools/                # 내장 도구
│   ├── internal/
│   └── index.ts
├── cli/                  # CLI 인터페이스
│   ├── CLIInterface.ts
│   ├── commands/
│   └── slash-commands/
├── config/               # 설정 관리
│   ├── ConfigManager.ts
│   └── types/
└── interfaces/            # 인터페이스 정의
    └── IInterface.ts
```

## Examples

### 기본 채팅

```bash
# 기본 모드로 시작
jindo chat

# TUI 모드로 시작
jindo chat --tui

# 프롬프트 지정하여 시작
jindo chat --system-prompt custom.md

# Markdown 출력으로 시작
jindo chat --format markdown

# Ollama 모델 변경
jindo chat --conversation-model ollama:llama3.1:8b

# OpenAI 사용 설정
jindo provider set openai:apiKey=your_key_here
jindo chat --conversation-model openai:gpt-4
```

### 멀티 프로바이더 사용

```bash
# OpenAI로 채팅
jindo provider set openai:apiKey=sk-xxx
jindo chat --conversation-model openai:gpt-4

# Anthropic 사용 설정
jindo provider set anthropic:apiKey=sk-ant-xxx
jindo chat --conversation-model anthropic:claude-3-sonnet
```

## Development

### 빌드

```bash
pnpm build
```

### TypeScript 타입 오류 해결

\_\_dirname과 같은 Node.js 전역 변수 사용 시 TypeScript에서 오류가 발생할 수 있습니다. 다음 해결 방법들이 있습니다:

#### 1. ESM import 사용 (권장)

```typescript
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

#### 2. 타입 선언 사용

```typescript
declare const __dirname: string;
```

#### 3. 경로 직접 계산

```typescript
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(fileURLToPath(import.meta.url), '..');
```

#### 4. 빌드시 번들 변수 사용

```typescript
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CONFIG_PATH = IS_PRODUCTION
  ? join(projectRoot, 'config', 'production.yaml')
  : join(projectRoot, 'config', 'development.yaml');
```

### 테스트

```bash
pnpm test
pnpm test:coverage
```

### 린트

```bash
pnpm lint
pnpm lint:fix
```

### 포맷

```bash
pnpm format
pnpm format:check
```

## Environment Variables

- `JINDO_CONFIG_PATH`: 설정 디렉토리 경로 오버라이드
- `DEBUG=1`: 디버그 모드 활성화
- `JINDO_PROMPT_SOURCE`: 프롬프트 소스 (future: langfuse)

## Roadmap

### Phase 1 (Current)

- [x] 프로젝트 셋업 및 아키텍처
- [x] Ollama 모델 통합
- [x] 코어 기능 (AgentController, Conversation, Memory)
- [x] MCP 통합
- [x] CLI 기본 기능
- [x] 내장 도구 기본 구조

### Phase 2 (In Progress)

- [ ] PromptManager 및 프롬프트 버전 관리
- [ ] ink 기반 TUI (방향키/자동완성)
- [ ] OpenAI/Anthropic/Groq Provider 추가
- [ ] 내장 도구 확장 (FileSystem, Shell)

### Phase 3 (Future)

- [ ] MCP 레지스트리 및 검색
- [ ] 멀티 에이전트 지원
- [ ] Langfuse/외부 프롬프트 관리
- [ ] Webpack/pkg 기반 실행파일

## Contributing

1. 이 저장소 클론
2. `pnpm install`로 의존성 설치
3. `pnpm build`로 빌드 확인
4. 기능 브랜치 생성
5. Pull Request 제출

## License

MIT License - [LICENSE](LICENSE) 파일 참조

## Support

- 🐛 버그 리포트: [Issues](https://github.com/username/jindo/issues)
- 💡 기능 요청: [Discussions](https://github.com/username/jindo/discussions)
- 📖 문서: [Wiki](https://github.com/username/jindo/wiki)

---

**Jindo**: Your local AI assistant, powered by Ollama and MCP. 🐕🚀
