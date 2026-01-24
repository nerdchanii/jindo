import type { CLIInterface } from '../CLIInterface.js';

export interface SlashCommand {
  name: string;
  args: string[];
  raw: string;
}

export interface SlashCommandHandler {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute: (args: string[], cli: CLIInterface) => Promise<boolean>;
}

export function parseSlashCommand(input: string): SlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const name = parts[0]?.toLowerCase();

  if (!name) return null;

  return {
    name,
    args: parts.slice(1),
    raw: trimmed,
  };
}

export class SlashCommandRegistry {
  private handlers: Map<string, SlashCommandHandler> = new Map();

  register(handler: SlashCommandHandler): void {
    this.handlers.set(handler.name, handler);

    if (handler.aliases) {
      for (const alias of handler.aliases) {
        this.handlers.set(alias, handler);
      }
    }
  }

  get(name: string): SlashCommandHandler | null {
    return this.handlers.get(name.toLowerCase()) ?? null;
  }

  list(): SlashCommandHandler[] {
    const seen = new Set<string>();
    const result: SlashCommandHandler[] = [];

    for (const handler of this.handlers.values()) {
      if (!seen.has(handler.name)) {
        seen.add(handler.name);
        result.push(handler);
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async execute(command: SlashCommand, cli: CLIInterface): Promise<boolean> {
    const handler = this.get(command.name);

    if (!handler) {
      cli.writeError(`Unknown command: /${command.name}`);
      cli.writeLine('Type /help for a list of commands.');
      return false;
    }

    return handler.execute(command.args, cli);
  }
}
