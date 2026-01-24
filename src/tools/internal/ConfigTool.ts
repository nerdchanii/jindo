import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import type { ToolDefinition } from '../../models/types/provider.js';
import type { JindoConfig } from '../../config/types/config.js';
import type { InternalTool, ToolContext, ToolResult } from './types.js';

type ConfigAction = 'get' | 'set' | 'list';

interface ConfigArgs {
  action: ConfigAction;
  key?: string;
  value?: string;
}

const TOOL_DEFINITION: ToolDefinition = {
  name: 'config',
  description: 'Get or set Jindo configuration values. Use "list" to see all settings, "get" to read a specific key, or "set" to update a value.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'list'],
        description: 'The action to perform: "get" reads a value, "set" updates a value, "list" shows all settings',
      },
      key: {
        type: 'string',
        description: 'The config key path (e.g., "agent.conversationModel", "agent.outputFormat")',
      },
      value: {
        type: 'string',
        description: 'The new value to set (required for "set" action)',
      },
    },
    required: ['action'],
  },
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num)) return num;
  return value;
}

export class ConfigTool implements InternalTool {
  getDefinition(): ToolDefinition {
    return TOOL_DEFINITION;
  }

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { action, key, value } = args as unknown as ConfigArgs;
    const configPath = join(context.configPath, 'config.yaml');

    if (!existsSync(configPath)) {
      return {
        success: false,
        message: `Config file not found: ${configPath}. Run "jindo init" first.`,
      };
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      const config = parse(content) as JindoConfig;

      switch (action) {
        case 'list': {
          const formattedConfig = stringify(config);
          return {
            success: true,
            message: `Current configuration:\n\n${formattedConfig}`,
            data: config,
          };
        }

        case 'get': {
          if (!key) {
            return {
              success: false,
              message: 'Key is required for "get" action. Example: config.get("agent.conversationModel")',
            };
          }

          const currentValue = getNestedValue(config as unknown as Record<string, unknown>, key);
          if (currentValue === undefined) {
            return {
              success: false,
              message: `Key "${key}" not found in configuration.`,
            };
          }

          return {
            success: true,
            message: `${key} = ${JSON.stringify(currentValue)}`,
            data: { key, value: currentValue },
          };
        }

        case 'set': {
          if (!key) {
            return {
              success: false,
              message: 'Key is required for "set" action.',
            };
          }
          if (value === undefined) {
            return {
              success: false,
              message: 'Value is required for "set" action.',
            };
          }

          const parsedValue = parseValue(value);
          const configObj = config as unknown as Record<string, unknown>;
          const oldValue = getNestedValue(configObj, key);
          setNestedValue(configObj, key, parsedValue);

          const yaml = stringify(configObj);
          writeFileSync(configPath, yaml, 'utf-8');

          return {
            success: true,
            message: `Updated ${key}: ${JSON.stringify(oldValue)} → ${JSON.stringify(parsedValue)}`,
            data: { key, oldValue, newValue: parsedValue },
          };
        }

        default:
          return {
            success: false,
            message: `Unknown action: ${action}. Use "get", "set", or "list".`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to ${action} config: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
