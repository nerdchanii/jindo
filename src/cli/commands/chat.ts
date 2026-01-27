import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../config/ConfigManager.js';
import { CLIInterface } from '../CLIInterface.js';
import { AgentController } from '../../core/AgentController.js';
import { ModelSelector } from '../../models/ModelSelector.js';
import { startTUI } from '../../tui/TUIApp.js';

export const chatCommand = new Command('chat')
  .description('Start interactive chat with the agent')
  .option('-f, --format <format>', 'Output format (text, markdown)', 'text')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-streaming', 'Disable streaming output')
  .option('--tui', 'Launch with TUI interface (ink-based)')
  .action(
    async (options: { format?: string; verbose?: boolean; streaming?: boolean; tui?: boolean }) => {
      const configManager = new ConfigManager();

      if (!configManager.configExists()) {
        console.error(chalk.red('✗ Jindo is not initialized.'));
        console.log(chalk.gray('Run `jindo init` to set up your configuration.'));
        process.exit(1);
      }

      const config = configManager.getConfig();

      // Check if TUI mode is requested
      if (options.tui) {
        console.log(chalk.blue('🐕 Starting Jindo TUI Mode...'));
        startTUI(configManager);
        return;
      }

      const format = options.format === 'markdown' ? 'markdown' : 'text';
      const streaming = options.streaming ?? true;

      const cli = new CLIInterface({
        format: format as 'text' | 'markdown',
        verbose: options.verbose ?? false,
        streaming,
        configManager,
      });

      const modelSelector = new ModelSelector({
        conversationModel: config.agent.conversationModel,
        functionModel: config.agent.functionModel,
        providers: config.agent.providers || {},
      });

      const agent = new AgentController({
        config: {
          modelSelector,
          maxHistoryMessages: config.agent.maxHistoryMessages,
          systemPrompt: 'You are Jindo, a helpful AI assistant. Be concise and helpful.',
        },
        configManager,
        streaming,
      });

      const initSpinner = cli.spinner('Initializing agent...');
      initSpinner.start();

      try {
        await agent.initialize();
        const ready = await agent.isReady();

        if (!ready) {
          initSpinner.fail('Agent initialization failed. Is Ollama running?');
          console.log(chalk.gray('\nMake sure Ollama is running: ollama serve'));
          console.log(chalk.gray('And the required models are installed:'));
          console.log(
            chalk.gray(`  ollama pull ${config.agent.conversationModel.replace('ollama:', '')}`)
          );
          console.log(
            chalk.gray(`  ollama pull ${config.agent.functionModel.replace('ollama:', '')}`)
          );
          process.exit(1);
        }

        initSpinner.succeed('Agent ready');
      } catch (error) {
        initSpinner.fail(
          `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }

      cli.onMessage(async (message: string) => {
        try {
          if (streaming) {
            cli.writeLine(chalk.cyan('\n🤖 Agent:'));
            cli.writeStream('  ');

            await agent.processMessage(message, {
              onChunk: (chunk: string) => {
                cli.writeStream(chunk);
              },
              onComplete: () => {
                cli.endStream();
                cli.writeLine('');
              },
              onError: (error: Error) => {
                cli.endStream();
                cli.writeError(error.message);
              },
            });
          } else {
            const spinner = cli.spinner('Thinking...');
            spinner.start();

            const response = await agent.processMessage(message);
            spinner.stop();

            if (response.text) {
              cli.writeLine(chalk.cyan('\n🤖 Agent:'));
              cli.writeLine(`  ${response.text}\n`);
            }

            if (response.toolCalls && response.toolCalls.length > 0) {
              cli.writeLine(
                chalk.gray(`  [Tools used: ${response.toolCalls.map((t) => t.name).join(', ')}]`)
              );
            }

            if (options.verbose) {
              cli.writeDebug(
                `Tokens: ${response.tokens.totalTokens}, Time: ${response.executionTime}ms`
              );
            }
          }
        } catch (error) {
          cli.writeError(error instanceof Error ? error.message : String(error));
        }
      });

      await cli.start();
    }
  );
