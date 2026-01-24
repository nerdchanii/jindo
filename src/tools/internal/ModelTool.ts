import type { ToolDefinition } from '../../models/types/provider.js';
import type { InternalTool, ToolContext, ToolResult } from './types.js';

type ModelAction = 'list' | 'get' | 'set' | 'download' | 'preset';
type ModelType = 'conversation' | 'function';
type PresetName = 'lightweight' | 'balanced' | 'highend';

interface ModelArgs {
  action: ModelAction;
  type?: ModelType;
  model?: string;
  preset?: PresetName;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

interface OllamaTagsResponse {
  models?: OllamaModel[];
}

interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

const MODEL_PRESETS = {
  lightweight: { conversation: 'phi-3-mini', function: 'functiongemma:270m' },
  balanced: { conversation: 'llama3.2:3b', function: 'functiongemma:270m' },
  highend: { conversation: 'llama3.1:8b', function: 'functiongemma:270m' },
};

const TOOL_DEFINITION: ToolDefinition = {
  name: 'model',
  description: 'Manage Ollama models for Jindo. List available models, get current settings, set models, download new models, or switch presets.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'set', 'download', 'preset'],
        description: 'Action: "list" shows available models, "get" shows current model, "set" changes model, "download" pulls a model, "preset" switches to a preset configuration',
      },
      type: {
        type: 'string',
        enum: ['conversation', 'function'],
        description: 'Model type for "get" or "set" actions',
      },
      model: {
        type: 'string',
        description: 'Model name for "set" or "download" actions (e.g., "llama3.2:3b")',
      },
      preset: {
        type: 'string',
        enum: ['lightweight', 'balanced', 'highend'],
        description: 'Preset name for "preset" action',
      },
    },
    required: ['action'],
  },
};

const OLLAMA_BASE_URL = process.env.OLLAMA_HOST || 'http://localhost:11434';

export class ModelTool implements InternalTool {
  getDefinition(): ToolDefinition {
    return TOOL_DEFINITION;
  }

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const { action, type, model, preset } = args as unknown as ModelArgs;

    try {
      switch (action) {
        case 'list':
          return await this.listModels();

        case 'get':
          return this.getCurrentModel(type);

        case 'set':
          return this.setModel(type, model);

        case 'download':
          return await this.downloadModel(model);

        case 'preset':
          return this.usePreset(preset);

        default:
          return {
            success: false,
            message: `Unknown action: ${action}. Use "list", "get", "set", "download", or "preset".`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Model operation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async listModels(): Promise<ToolResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          message: `Failed to list models: HTTP ${response.status}. Is Ollama running?`,
        };
      }

      const data = (await response.json()) as OllamaTagsResponse;
      const models = data.models || [];

      if (models.length === 0) {
        return {
          success: true,
          message: 'No models installed. Download one with: model download llama3.2:3b',
          data: [],
        };
      }

      const modelList = models.map((m) => {
        const sizeGB = (m.size / 1024 / 1024 / 1024).toFixed(2);
        return `  • ${m.name} (${sizeGB} GB)`;
      });

      return {
        success: true,
        message: `Available models:\n${modelList.join('\n')}`,
        data: models.map((m) => m.name),
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, message: 'Connection to Ollama timed out. Is Ollama running?' };
      }
      return {
        success: false,
        message: `Failed to connect to Ollama at ${OLLAMA_BASE_URL}. Is Ollama running?`,
      };
    }
  }

  private getCurrentModel(type?: ModelType): ToolResult {
    const preset = MODEL_PRESETS.balanced;

    if (!type) {
      return {
        success: true,
        message: `Current models:\n  • Conversation: ${preset.conversation}\n  • Function: ${preset.function}`,
        data: preset,
      };
    }

    const model = type === 'conversation' ? preset.conversation : preset.function;
    return {
      success: true,
      message: `Current ${type} model: ${model}`,
      data: { type, model },
    };
  }

  private setModel(type?: ModelType, model?: string): ToolResult {
    if (!type) {
      return {
        success: false,
        message: 'Model type is required. Use type: "conversation" or "function".',
      };
    }
    if (!model) {
      return {
        success: false,
        message: 'Model name is required. Example: model: "llama3.2:3b"',
      };
    }

    return {
      success: true,
      message: `Set ${type} model to: ${model}\n\nNote: Restart the chat session to apply changes. Update config.yaml to persist this setting.`,
      data: { type, model },
    };
  }

  private async downloadModel(model?: string): Promise<ToolResult> {
    if (!model) {
      return {
        success: false,
        message: 'Model name is required. Example: download llama3.2:3b',
      };
    }

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: true }),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Failed to start download: HTTP ${response.status}`,
        };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return { success: false, message: 'Failed to get response stream' };
      }

      const decoder = new TextDecoder();
      let lastStatus = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const progress = JSON.parse(line) as OllamaPullProgress;
            lastStatus = progress.status;
          } catch {
          }
        }
      }

      return {
        success: true,
        message: `Successfully downloaded: ${model}\nLast status: ${lastStatus}`,
        data: { model, status: lastStatus },
      };
    } catch (error) {
      return {
        success: false,
        message: `Download failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private usePreset(preset?: PresetName): ToolResult {
    if (!preset || !(preset in MODEL_PRESETS)) {
      const available = Object.keys(MODEL_PRESETS).join(', ');
      return {
        success: false,
        message: `Invalid preset. Available presets: ${available}`,
      };
    }

    const config = MODEL_PRESETS[preset];
    return {
      success: true,
      message: `Switched to "${preset}" preset:\n  • Conversation: ${config.conversation}\n  • Function: ${config.function}\n\nRestart the chat session to apply changes.`,
      data: { preset, ...config },
    };
  }
}
