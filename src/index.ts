#!/usr/bin/env node

import { Command } from 'commander';
import {
  initCommand,
  chatCommand,
  mcpCommand,
  modelCommand,
  configCommand,
  providerCommand,
} from './cli/commands/index.js';

const program = new Command();

program
  .name('jindo')
  .description('Ollama-based MCP agent with local models and CLI interface')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(chatCommand);
program.addCommand(mcpCommand);
program.addCommand(modelCommand);
program.addCommand(configCommand);
program.addCommand(providerCommand);

program
  .command('doctor')
  .description('Check Jindo installation and dependencies')
  .action(async () => {
    const { execSync } = await import('node:child_process');
    const { ConfigManager } = await import('./config/ConfigManager.js');
    const chalk = (await import('chalk')).default;

    console.log(chalk.cyan('\n🔍 Jindo Doctor\n'));

    const checks: { name: string; status: 'ok' | 'warn' | 'error'; message: string }[] = [];

    const configManager = new ConfigManager();
    if (configManager.configExists()) {
      checks.push({ name: 'Configuration', status: 'ok', message: configManager.getConfigDir() });
    } else {
      checks.push({
        name: 'Configuration',
        status: 'warn',
        message: 'Not initialized. Run `jindo init`',
      });
    }

    try {
      execSync('ollama --version', { stdio: 'ignore' });
      checks.push({ name: 'Ollama', status: 'ok', message: 'Installed' });

      try {
        const output = execSync('ollama list', { encoding: 'utf-8' });
        const lines = output
          .split('\n')
          .slice(1)
          .filter((l) => l.trim());
        if (lines.length > 0) {
          checks.push({
            name: 'Ollama Models',
            status: 'ok',
            message: `${lines.length} model(s) installed`,
          });
        } else {
          checks.push({ name: 'Ollama Models', status: 'warn', message: 'No models installed' });
        }
      } catch {
        checks.push({ name: 'Ollama Models', status: 'warn', message: 'Could not list models' });
      }
    } catch {
      checks.push({
        name: 'Ollama',
        status: 'error',
        message: 'Not installed. Run: brew install ollama',
      });
    }

    try {
      execSync('node --version', { stdio: 'ignore' });
      const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
      checks.push({ name: 'Node.js', status: 'ok', message: nodeVersion });
    } catch {
      checks.push({ name: 'Node.js', status: 'error', message: 'Not found' });
    }

    for (const check of checks) {
      const icon =
        check.status === 'ok'
          ? chalk.green('✓')
          : check.status === 'warn'
            ? chalk.yellow('⚠')
            : chalk.red('✗');
      const msg =
        check.status === 'error'
          ? chalk.red(check.message)
          : check.status === 'warn'
            ? chalk.yellow(check.message)
            : chalk.gray(check.message);
      console.log(`  ${icon} ${check.name}: ${msg}`);
    }

    console.log('');

    const hasErrors = checks.some((c) => c.status === 'error');
    if (hasErrors) {
      console.log(chalk.red('Some checks failed. Please fix the issues above.'));
      process.exit(1);
    } else {
      console.log(chalk.green('All checks passed! Jindo is ready to use.'));
    }
  });

program.parse();
