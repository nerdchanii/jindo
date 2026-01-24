import * as readline from 'node:readline';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import type { IInterface, ISpinner, OutputFormat, SelectChoice } from '../interfaces/IInterface.js';
import {
  parseSlashCommand,
  SlashCommandRegistry,
  allCommands,
  type SlashCommandHandler,
} from './slash-commands/index.js';
import { ConfigManager } from '../config/ConfigManager.js';

export interface CLIInterfaceOptions {
  format?: OutputFormat;
  verbose?: boolean;
  streaming?: boolean;
  configManager?: ConfigManager;
}

export interface AgentStats {
  messageCount: number;
  memoryCount: number;
  toolCount: number;
  model: string | null;
}

class OraSpinner implements ISpinner {
  private spinner: Ora;

  constructor(text: string) {
    this.spinner = ora(text);
  }

  start(): void {
    this.spinner.start();
  }

  stop(): void {
    this.spinner.stop();
  }

  succeed(text?: string): void {
    this.spinner.succeed(text);
  }

  fail(text?: string): void {
    this.spinner.fail(text);
  }

  text(text: string): void {
    this.spinner.text = text;
  }
}

export class CLIInterface implements IInterface {
  private rl: readline.Interface | null = null;
  private slashCommands: SlashCommandRegistry;
  public readonly format: OutputFormat;
  private verbose: boolean;
  public readonly streaming: boolean;
  private configManager: ConfigManager;
  private running: boolean = false;
  private messageCount: number = 0;
  private onMessageCallback: ((message: string) => Promise<void>) | null = null;

  constructor(options: CLIInterfaceOptions = {}) {
    this.format = options.format ?? 'text';
    this.verbose = options.verbose ?? false;
    this.streaming = options.streaming ?? true;
    this.configManager = options.configManager ?? new ConfigManager();

    this.slashCommands = new SlashCommandRegistry();
    for (const cmd of allCommands) {
      this.slashCommands.register(cmd);
    }
  }

  onMessage(callback: (message: string) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  async start(): Promise<void> {
    this.running = true;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 100,
    });

    this.rl.on('close', () => {
      this.running = false;
    });

    this.writeLine(chalk.cyan('\n🐕 Jindo Agent Started'));
    this.writeLine(chalk.gray('Type /help for commands, /exit to quit\n'));

    await this.repl();
  }

  private async repl(): Promise<void> {
    while (this.running) {
      const input = await this.prompt();

      if (input === null) {
        break;
      }

      const trimmed = input.trim();
      if (!trimmed) continue;

      const slashCmd = parseSlashCommand(trimmed);
      if (slashCmd) {
        await this.slashCommands.execute(slashCmd, this);
        continue;
      }

      if (this.onMessageCallback) {
        this.messageCount++;
        try {
          await this.onMessageCallback(trimmed);
        } catch (error) {
          this.writeError(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        this.writeWarning('No message handler registered.');
      }
    }
  }

  private prompt(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.rl || !this.running) {
        resolve(null);
        return;
      }

      this.rl.question(chalk.green('> '), (answer) => {
        resolve(answer);
      });
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    process.exit(0);
  }

  writeLine(message: string): void {
    console.log(message);
  }

  writeError(message: string): void {
    console.error(chalk.red(`✗ ${message}`));
  }

  writeWarning(message: string): void {
    console.warn(chalk.yellow(`⚠ ${message}`));
  }

  writeSuccess(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }

  writeDebug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`[debug] ${message}`));
    }
  }

  writeStream(chunk: string): void {
    process.stdout.write(chunk);
  }

  endStream(): void {
    process.stdout.write('\n');
  }

  async ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.rl) {
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
      }

      this.rl.question(chalk.cyan(`${question} `), (answer) => {
        resolve(answer);
      });
    });
  }

  async confirm(question: string, defaultValue: boolean = false): Promise<boolean> {
    const hint = defaultValue ? '[Y/n]' : '[y/N]';
    const answer = await this.ask(`${question} ${hint}`);

    if (!answer) return defaultValue;

    return answer.toLowerCase().startsWith('y');
  }

  async select<T extends string>(message: string, choices: SelectChoice<T>[]): Promise<T> {
    this.writeLine(`\n${message}\n`);

    choices.forEach((choice, index) => {
      const disabled = choice.disabled ? chalk.gray(' (disabled)') : '';
      const desc = choice.description ? chalk.gray(` - ${choice.description}`) : '';
      this.writeLine(`  ${index + 1}. ${choice.name}${desc}${disabled}`);
    });

    while (true) {
      const answer = await this.ask('\nSelect option (number):');
      const num = parseInt(answer, 10);

      if (num >= 1 && num <= choices.length) {
        const selected = choices[num - 1];
        if (!selected.disabled) {
          return selected.value;
        }
        this.writeWarning('That option is disabled.');
      } else {
        this.writeWarning(`Please enter a number between 1 and ${choices.length}`);
      }
    }
  }

  spinner(text: string): ISpinner {
    return new OraSpinner(text);
  }

  clear(): void {
    console.clear();
  }

  table(headers: string[], rows: string[][]): void {
    const colWidths = headers.map((h, i) => {
      const maxDataWidth = Math.max(...rows.map((r) => (r[i] || '').length));
      return Math.max(h.length, maxDataWidth);
    });

    const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
    const separator = colWidths.map((w) => '-'.repeat(w)).join('  ');

    this.writeLine(chalk.bold(headerRow));
    this.writeLine(chalk.gray(separator));

    for (const row of rows) {
      const formattedRow = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('  ');
      this.writeLine(formattedRow);
    }
  }

  box(title: string, content: string): void {
    const lines = content.split('\n');
    const maxWidth = Math.max(title.length, ...lines.map((l) => l.length)) + 4;

    this.writeLine(chalk.cyan('┌' + '─'.repeat(maxWidth) + '┐'));
    this.writeLine(chalk.cyan('│ ') + chalk.bold(title.padEnd(maxWidth - 2)) + chalk.cyan(' │'));
    this.writeLine(chalk.cyan('├' + '─'.repeat(maxWidth) + '┤'));

    for (const line of lines) {
      this.writeLine(chalk.cyan('│ ') + line.padEnd(maxWidth - 2) + chalk.cyan(' │'));
    }

    this.writeLine(chalk.cyan('└' + '─'.repeat(maxWidth) + '┘'));
  }

  clearConversation(): void {
    this.messageCount = 0;
  }

  getSlashCommands(): SlashCommandHandler[] {
    return this.slashCommands.list();
  }

  getStats(): AgentStats {
    return {
      messageCount: this.messageCount,
      memoryCount: 0,
      toolCount: 0,
      model: null,
    };
  }

  getAvailableModels(): string[] {
    return ['ollama:llama3.2:3b', 'ollama:phi-3-mini', 'ollama:llama3.1:8b'];
  }

  getCurrentModel(): string | null {
    try {
      const config = this.configManager.getConfig();
      return config.agent.conversationModel;
    } catch {
      return null;
    }
  }

  async setModel(_modelName: string): Promise<boolean> {
    return false;
  }

  getConfigValue(path?: string): unknown {
    try {
      const config = this.configManager.getConfig();
      if (!path) return config;

      const parts = path.split('.');
      let current: unknown = config;

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }

      return current;
    } catch {
      return undefined;
    }
  }

  setConfigValue(_path: string, _value: string): boolean {
    return false;
  }
}
