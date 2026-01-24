import { Command } from 'commander';
import chalk from 'chalk';
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigManager } from '../../config/ConfigManager.js';
import { CLIInterface } from '../CLIInterface.js';
import { parse } from 'yaml';

interface ModelInfo {
  size: string;
  contextLength: number;
  type: string;
  provider: string;
  description: string;
  notes?: string[];
}

interface ModelPreset {
  name: string;
  description: string;
  conversationModel: string;
  functionModel: string;
  vram: string;
  disk: string;
}

interface BuiltinModels {
  presets: Record<string, ModelPreset>;
  models: Record<string, ModelInfo>;
}

function getBuiltinModelsPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '../../../config/builtin-models.yaml');
}

function loadBuiltinModels(): BuiltinModels {
  const modelsPath = getBuiltinModelsPath();
  if (!existsSync(modelsPath)) {
    throw new Error(`Built-in models config not found: ${modelsPath}`);
  }
  const content = readFileSync(modelsPath, 'utf-8');
  return parse(content) as BuiltinModels;
}

function isOllamaInstalled(): boolean {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getLocalOllamaModels(): string[] {
  try {
    const output = execSync('ollama list', { encoding: 'utf-8' });
    const lines = output.split('\n').slice(1);
    return lines.map((line) => line.split(/\s+/)[0]).filter((name) => name && name.length > 0);
  } catch {
    return [];
  }
}

export const modelCommand = new Command('model').description('Manage Ollama models');

modelCommand
  .command('list')
  .description('List available and installed models')
  .action(() => {
    const cli = new CLIInterface();

    if (!isOllamaInstalled()) {
      cli.writeError('Ollama is not installed.');
      cli.writeLine(chalk.gray('Install it with: brew install ollama'));
      process.exit(1);
    }

    const localModels = getLocalOllamaModels();

    cli.writeLine('\n🤖 Local Ollama Models:\n');

    if (localModels.length === 0) {
      cli.writeLine(chalk.gray('  No models installed.'));
      cli.writeLine(chalk.gray('  Use `jindo model download <model>` to install one.'));
    } else {
      for (const model of localModels) {
        cli.writeLine(`  • ${model}`);
      }
    }

    try {
      const builtinModels = loadBuiltinModels();

      cli.writeLine('\n📦 Recommended Models:\n');

      const rows = Object.entries(builtinModels.models).map(([name, info]) => {
        const installed = localModels.some((m) => m.startsWith(name))
          ? chalk.green('✓')
          : chalk.gray('○');
        return [installed, name, info.type, info.size, info.description];
      });

      cli.table(['', 'Model', 'Type', 'Size', 'Description'], rows);

      cli.writeLine('\n📋 Presets:\n');

      const presetRows = Object.entries(builtinModels.presets).map(([name, preset]) => {
        return [name, preset.conversationModel, preset.functionModel, preset.vram];
      });

      cli.table(['Preset', 'Conversation', 'Function', 'VRAM'], presetRows);
    } catch {}

    cli.writeLine('');
  });

modelCommand
  .command('download <model>')
  .description('Download an Ollama model')
  .action(async (model: string) => {
    const cli = new CLIInterface();

    if (!isOllamaInstalled()) {
      cli.writeError('Ollama is not installed.');
      cli.writeLine(chalk.gray('Install it with: brew install ollama'));
      process.exit(1);
    }

    cli.writeLine(`\n📥 Downloading model: ${model}\n`);

    const child = spawn('ollama', ['pull', model], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        cli.writeSuccess(`Model "${model}" downloaded successfully.`);
      } else {
        cli.writeError(`Failed to download model "${model}".`);
      }
      process.exit(code ?? 1);
    });

    child.on('error', (error) => {
      cli.writeError(`Error: ${error.message}`);
      process.exit(1);
    });
  });

modelCommand
  .command('set')
  .description('Set model preset or specific model')
  .argument('<type>', 'Type: preset, conversation, or function')
  .argument('<value>', 'Preset name or model name')
  .action((type: string, value: string) => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    if (!configManager.configExists()) {
      cli.writeError('Jindo is not initialized. Run `jindo init` first.');
      process.exit(1);
    }

    try {
      const config = configManager.getConfig();

      if (type === 'preset') {
        const builtinModels = loadBuiltinModels();
        const preset = builtinModels.presets[value];

        if (!preset) {
          cli.writeError(`Unknown preset: ${value}`);
          cli.writeLine(`Available presets: ${Object.keys(builtinModels.presets).join(', ')}`);
          process.exit(1);
        }

        config.agent.conversationModel = preset.conversationModel;
        config.agent.functionModel = preset.functionModel;

        configManager.saveConfig(config);

        cli.writeSuccess(`Preset "${value}" applied.`);
        cli.writeLine(`  Conversation model: ${preset.conversationModel}`);
        cli.writeLine(`  Function model: ${preset.functionModel}`);
      } else if (type === 'conversation') {
        config.agent.conversationModel = value;
        configManager.saveConfig(config);
        cli.writeSuccess(`Conversation model set to: ${value}`);
      } else if (type === 'function') {
        config.agent.functionModel = value;
        configManager.saveConfig(config);
        cli.writeSuccess(`Function model set to: ${value}`);
      } else {
        cli.writeError(`Unknown type: ${type}`);
        cli.writeLine('Available types: preset, conversation, function');
        process.exit(1);
      }
    } catch (error) {
      cli.writeError(
        `Failed to set model: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

modelCommand
  .command('info <model>')
  .description('Show information about a model')
  .action((model: string) => {
    const cli = new CLIInterface();

    try {
      const builtinModels = loadBuiltinModels();
      const info = builtinModels.models[model];

      if (!info) {
        cli.writeWarning(`Model "${model}" not found in built-in database.`);

        if (isOllamaInstalled()) {
          cli.writeLine('\nTrying to get info from Ollama...\n');
          try {
            const output = execSync(`ollama show ${model}`, { encoding: 'utf-8' });
            cli.writeLine(output);
          } catch {
            cli.writeError('Model not found in Ollama either.');
          }
        }
        return;
      }

      cli.writeLine(`\n📖 Model: ${model}\n`);
      cli.writeLine(`  Type: ${info.type}`);
      cli.writeLine(`  Provider: ${info.provider}`);
      cli.writeLine(`  Size: ${info.size}`);
      cli.writeLine(`  Context Length: ${info.contextLength}`);
      cli.writeLine(`  Description: ${info.description}`);

      if (info.notes && info.notes.length > 0) {
        cli.writeLine('\n  Notes:');
        for (const note of info.notes) {
          cli.writeLine(`    • ${note}`);
        }
      }

      cli.writeLine('');
    } catch (error) {
      cli.writeError(
        `Failed to get model info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
