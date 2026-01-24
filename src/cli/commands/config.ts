import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../config/ConfigManager.js';
import { CLIInterface } from '../CLIInterface.js';

export const configCommand = new Command('config').description('Manage Jindo configuration');

configCommand
  .command('get [path]')
  .description('Get configuration value')
  .action((path?: string) => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    if (!configManager.configExists()) {
      cli.writeError('Jindo is not initialized. Run `jindo init` first.');
      process.exit(1);
    }

    try {
      const config = configManager.getConfig();

      if (!path) {
        cli.writeLine('\n📋 Current Configuration:\n');
        cli.writeLine(JSON.stringify(config, null, 2));
        cli.writeLine('');
        return;
      }

      const parts = path.split('.');
      let value: unknown = config;

      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          cli.writeError(`Path not found: ${path}`);
          process.exit(1);
        }
      }

      if (typeof value === 'object') {
        cli.writeLine(JSON.stringify(value, null, 2));
      } else {
        cli.writeLine(String(value));
      }
    } catch (error) {
      cli.writeError(
        `Failed to get config: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

configCommand
  .command('set <path> <value>')
  .description('Set configuration value')
  .action((path: string, value: string) => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    if (!configManager.configExists()) {
      cli.writeError('Jindo is not initialized. Run `jindo init` first.');
      process.exit(1);
    }

    try {
      const config = configManager.getConfig();
      const parts = path.split('.');
      let target: Record<string, unknown> = config as unknown as Record<string, unknown>;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in target) || typeof target[part] !== 'object') {
          cli.writeError(`Invalid path: ${path}`);
          process.exit(1);
        }
        target = target[part] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];
      const currentValue = target[lastPart];

      let parsedValue: unknown = value;
      if (typeof currentValue === 'number') {
        parsedValue = Number(value);
        if (isNaN(parsedValue as number)) {
          cli.writeError(`Invalid number: ${value}`);
          process.exit(1);
        }
      } else if (typeof currentValue === 'boolean') {
        parsedValue = value === 'true' || value === '1' || value === 'yes';
      }

      target[lastPart] = parsedValue;
      configManager.saveConfig(config);

      cli.writeSuccess(`${path} = ${parsedValue}`);
    } catch (error) {
      cli.writeError(
        `Failed to set config: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

configCommand
  .command('path')
  .description('Show configuration file path')
  .action(() => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    cli.writeLine(`\n📁 Configuration directory: ${configManager.getConfigDir()}`);
    cli.writeLine(`   Config file: ${configManager.getConfigPath()}`);
    cli.writeLine(`   MCP settings: ${configManager.getMCPSettingsPath()}`);

    if (configManager.configExists()) {
      cli.writeLine(chalk.green('\n   ✓ Configuration exists'));
    } else {
      cli.writeLine(chalk.yellow('\n   ○ Configuration not found'));
      cli.writeLine(chalk.gray('     Run `jindo init` to create one.'));
    }

    cli.writeLine('');
  });

configCommand
  .command('reset')
  .description('Reset configuration to default')
  .action(async () => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    const confirm = await cli.confirm('Are you sure you want to reset configuration?', false);

    if (!confirm) {
      cli.writeLine('Cancelled.');
      process.exit(0);
    }

    try {
      const { execSync } = await import('node:child_process');
      const configDir = configManager.getConfigDir();

      execSync(`rm -rf "${configDir}"`, { stdio: 'ignore' });

      cli.writeSuccess('Configuration reset.');
      cli.writeLine(chalk.gray('Run `jindo init` to set up again.'));
    } catch (error) {
      cli.writeError(
        `Failed to reset config: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }

    process.exit(0);
  });
