import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigManager } from '../../config/ConfigManager.js';
import { CLIInterface } from '../CLIInterface.js';
import { parse } from 'yaml';

interface ModelPreset {
  name: string;
  description: string;
  conversationModel: string;
  functionModel: string;
  vram: string;
  disk: string;
  notes?: string[];
}

interface BuiltinModels {
  presets: Record<string, ModelPreset>;
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

function getDefaultConfigPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '../../../config/default.config.yaml');
}

export const initCommand = new Command('init')
  .description('Initialize Jindo configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-p, --preset <preset>', 'Use a specific preset (lightweight, balanced, highend)')
  .action(async (options: { force?: boolean; preset?: string }) => {
    const cli = new CLIInterface({ verbose: true });
    const configManager = new ConfigManager();

    cli.writeLine(chalk.cyan('\n🐕 Jindo Initialization\n'));

    if (configManager.configExists() && !options.force) {
      cli.writeWarning(`Configuration already exists at: ${configManager.getConfigDir()}`);
      const overwrite = await cli.confirm('Do you want to overwrite it?', false);
      if (!overwrite) {
        cli.writeLine('Initialization cancelled.');
        process.exit(0);
      }
    }

    let builtinModels: BuiltinModels;
    try {
      builtinModels = loadBuiltinModels();
    } catch (error) {
      cli.writeError(
        `Failed to load built-in models: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }

    const presetNames = Object.keys(builtinModels.presets);
    let selectedPreset: string;

    if (options.preset) {
      if (!presetNames.includes(options.preset)) {
        cli.writeError(`Invalid preset: ${options.preset}`);
        cli.writeLine(`Available presets: ${presetNames.join(', ')}`);
        process.exit(1);
      }
      selectedPreset = options.preset;
    } else {
      const choices = presetNames.map((name) => {
        const preset = builtinModels.presets[name];
        return {
          name: preset.name,
          value: name,
          description: `${preset.description} (VRAM: ${preset.vram}, Disk: ${preset.disk})`,
        };
      });

      cli.writeLine('Select a model preset based on your hardware:\n');
      selectedPreset = await cli.select('Choose a preset:', choices);
    }

    const preset = builtinModels.presets[selectedPreset];
    cli.writeLine(`\n${chalk.bold('Selected preset:')} ${preset.name}`);
    cli.writeLine(`  Conversation model: ${preset.conversationModel}`);
    cli.writeLine(`  Function model: ${preset.functionModel}`);
    cli.writeLine(`  VRAM requirement: ${preset.vram}`);
    cli.writeLine(`  Disk requirement: ${preset.disk}`);

    if (preset.notes && preset.notes.length > 0) {
      cli.writeLine('\n  Notes:');
      for (const note of preset.notes) {
        cli.writeLine(`    • ${note}`);
      }
    }

    const spinner = cli.spinner('Creating configuration...');
    spinner.start();

    try {
      configManager.ensureConfigDir();

      const defaultConfigPath = getDefaultConfigPath();
      if (!existsSync(defaultConfigPath)) {
        spinner.fail('Default config template not found');
        process.exit(1);
      }

      const defaultContent = readFileSync(defaultConfigPath, 'utf-8');
      const updatedContent = defaultContent
        .replace(/conversationModel:.*$/m, `conversationModel: ${preset.conversationModel}`)
        .replace(/functionModel:.*$/m, `functionModel: ${preset.functionModel}`);

      const configPath = configManager.getConfigPath();
      const fs = await import('node:fs');
      fs.writeFileSync(configPath, updatedContent, 'utf-8');

      const mcpSettingsPath = configManager.getMCPSettingsPath();
      if (!existsSync(mcpSettingsPath)) {
        fs.writeFileSync(mcpSettingsPath, JSON.stringify({ servers: {} }, null, 2), 'utf-8');
      }

      spinner.succeed('Configuration created');

      cli.writeLine(
        `\n${chalk.green('✓')} Configuration saved to: ${configManager.getConfigDir()}`
      );
      cli.writeLine(`\n${chalk.cyan('Next steps:')}`);
      cli.writeLine(`  1. Install Ollama: ${chalk.gray('brew install ollama')}`);
      cli.writeLine(`  2. Pull models:`);
      cli.writeLine(
        `     ${chalk.gray(`ollama pull ${preset.conversationModel.replace('ollama:', '')}`)}`
      );
      cli.writeLine(
        `     ${chalk.gray(`ollama pull ${preset.functionModel.replace('ollama:', '')}`)}`
      );
      cli.writeLine(`  3. Start chatting: ${chalk.gray('jindo chat')}\n`);
    } catch (error) {
      spinner.fail('Failed to create configuration');
      cli.writeError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    process.exit(0);
  });
