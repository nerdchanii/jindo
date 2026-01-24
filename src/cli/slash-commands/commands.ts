import type { SlashCommandHandler } from './parser.js';
import type { CLIInterface } from '../CLIInterface.js';

export const clearCommand: SlashCommandHandler = {
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear conversation history',
  execute: async (_args: string[], cli: CLIInterface): Promise<boolean> => {
    cli.clearConversation();
    cli.clear();
    cli.writeSuccess('Conversation cleared.');
    return true;
  },
};

export const helpCommand: SlashCommandHandler = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands',
  execute: async (_args: string[], cli: CLIInterface): Promise<boolean> => {
    const commands = cli.getSlashCommands();

    cli.writeLine('\n📚 Available Commands:\n');

    const rows = commands.map((cmd) => [
      `/${cmd.name}`,
      cmd.aliases ? `(${cmd.aliases.join(', ')})` : '',
      cmd.description,
    ]);

    cli.table(['Command', 'Aliases', 'Description'], rows);
    cli.writeLine('');

    return true;
  },
};

export const exitCommand: SlashCommandHandler = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit the chat',
  execute: async (_args: string[], cli: CLIInterface): Promise<boolean> => {
    cli.writeLine('\n👋 Goodbye!\n');
    await cli.stop();
    return true;
  },
};

export const statsCommand: SlashCommandHandler = {
  name: 'stats',
  description: 'Show agent statistics',
  execute: async (_args: string[], cli: CLIInterface): Promise<boolean> => {
    const stats = cli.getStats();

    cli.writeLine('\n📊 Agent Statistics:\n');

    cli.writeLine(`Conversation: ${stats.messageCount} messages`);
    cli.writeLine(`Memory: ${stats.memoryCount} entries`);
    cli.writeLine(`Tools: ${stats.toolCount} registered`);
    cli.writeLine(`Model: ${stats.model || 'Not initialized'}`);
    cli.writeLine('');

    return true;
  },
};

export const modelCommand: SlashCommandHandler = {
  name: 'model',
  description: 'Show or change model (usage: /model [list|set <name>])',
  usage: '/model [list|set <name>]',
  execute: async (args: string[], cli: CLIInterface): Promise<boolean> => {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || subcommand === 'list') {
      const models = cli.getAvailableModels();
      const currentModel = cli.getCurrentModel();

      cli.writeLine('\n🤖 Available Models:\n');

      for (const model of models) {
        const marker = model === currentModel ? '✓' : ' ';
        cli.writeLine(`  ${marker} ${model}`);
      }

      cli.writeLine('');
      return true;
    }

    if (subcommand === 'set') {
      const modelName = args[1];
      if (!modelName) {
        cli.writeError('Usage: /model set <model-name>');
        return false;
      }

      const success = await cli.setModel(modelName);
      if (success) {
        cli.writeSuccess(`Model changed to: ${modelName}`);
      } else {
        cli.writeError(`Failed to change model to: ${modelName}`);
      }
      return success;
    }

    cli.writeError('Unknown subcommand. Usage: /model [list|set <name>]');
    return false;
  },
};

export const configCommand: SlashCommandHandler = {
  name: 'config',
  description: 'Show or change config (usage: /config [get <path>|set <path> <value>])',
  usage: '/config [get <path>|set <path> <value>]',
  execute: async (args: string[], cli: CLIInterface): Promise<boolean> => {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || subcommand === 'get') {
      const path = args[1];
      const value = cli.getConfigValue(path);

      if (path) {
        cli.writeLine(`${path}: ${JSON.stringify(value, null, 2)}`);
      } else {
        cli.writeLine(JSON.stringify(value, null, 2));
      }
      return true;
    }

    if (subcommand === 'set') {
      const path = args[1];
      const value = args.slice(2).join(' ');

      if (!path || !value) {
        cli.writeError('Usage: /config set <path> <value>');
        return false;
      }

      const success = cli.setConfigValue(path, value);
      if (success) {
        cli.writeSuccess(`Config updated: ${path} = ${value}`);
      } else {
        cli.writeError(`Failed to update config: ${path}`);
      }
      return success;
    }

    cli.writeError('Unknown subcommand. Usage: /config [get <path>|set <path> <value>]');
    return false;
  },
};

export const allCommands: SlashCommandHandler[] = [
  clearCommand,
  helpCommand,
  exitCommand,
  statsCommand,
  modelCommand,
  configCommand,
];
