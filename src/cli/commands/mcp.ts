import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../config/ConfigManager.js';
import { CLIInterface } from '../CLIInterface.js';
import { RegistryClient } from '../../registry/RegistryClient.js';
import type { MCPServerConfig } from '../../config/types/config.js';

export const mcpCommand = new Command('mcp').description('Manage MCP servers');

mcpCommand
  .command('list')
  .description('List configured MCP servers')
  .action(() => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    if (!configManager.configExists()) {
      cli.writeError('Jindo is not initialized. Run `jindo init` first.');
      process.exit(1);
    }

    try {
      const config = configManager.getConfig();
      const servers = config.mcp?.servers || {};
      const serverNames = Object.keys(servers);

      if (serverNames.length === 0) {
        cli.writeLine('\nNo MCP servers configured.');
        cli.writeLine(chalk.gray('Use `jindo mcp add <server>` to add one.\n'));
        return;
      }

      cli.writeLine('\n📡 Configured MCP Servers:\n');

      const rows = serverNames.map((name) => {
        const server = servers[name];
        const status = server.enabled ? chalk.green('✓') : chalk.gray('○');
        const type = server.type || 'custom';
        return [status, name, type, server.command];
      });

      cli.table(['', 'Name', 'Type', 'Command'], rows);
      cli.writeLine('');
    } catch (error) {
      cli.writeError(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

mcpCommand
  .command('add <name>')
  .description('Add an MCP server')
  .option('-c, --command <command>', 'Command to run the server')
  .option('-a, --args <args...>', 'Arguments for the command')
  .option('-r, --registry', 'Add from builtin registry')
  .action(
    async (name: string, options: { command?: string; args?: string[]; registry?: boolean }) => {
      const configManager = new ConfigManager();
      const cli = new CLIInterface();

      if (!configManager.configExists()) {
        cli.writeError('Jindo is not initialized. Run `jindo init` first.');
        process.exit(1);
      }

      try {
        const config = configManager.getConfig();

        if (config.mcp.servers[name]) {
          cli.writeWarning(`Server "${name}" already exists.`);
          const overwrite = await cli.confirm('Do you want to overwrite it?', false);
          if (!overwrite) {
            cli.writeLine('Cancelled.');
            process.exit(0);
          }
        }

        let serverConfig;

        if (options.registry) {
          const registry = new RegistryClient();

          const server = await registry.getServer(name);
          if (!server) {
            cli.writeError(`Server "${name}" not found in builtin registry.`);
            const availableServers = await registry.listServers();
            cli.writeLine('\nAvailable servers:');
            availableServers.forEach((s) => {
              cli.writeLine(`  ${chalk.cyan(s.id)}: ${s.description}`);
            });
            process.exit(1);
          }

          const serverConfig = await registry.serverToMcpConfig(name);

          if (!serverConfig) {
            cli.writeError(`Failed to create server configuration for "${name}".`);
            process.exit(1);
          }

          cli.writeLine(chalk.green(`✓ Found server: ${server.name}`));
          cli.writeLine(chalk.gray(`Package: ${server.package}@${server.version}`));
          cli.writeLine(chalk.gray(`Command: ${server.command} ${server.args.join(' ')}`));

          if (server.env && Object.keys(server.env).length > 0) {
            cli.writeLine('\nRequired environment variables:');
            const customEnv: Record<string, string> = {};

            for (const [key, template] of Object.entries(server.env)) {
              if (template.includes('${')) {
                const envValue = await cli.ask(`Enter value for ${key} (${template}):`);
                if (envValue.trim()) {
                  customEnv[key] = envValue;
                }
              }
            }

            if (Object.keys(customEnv).length > 0) {
              const serverConfigWithEnv = await registry.serverToMcpConfig(name, customEnv);
              if (serverConfigWithEnv) {
                serverConfig = serverConfigWithEnv;
              }
            }
          }
        } else {
          let command = options.command;
          let args = options.args || [];

          if (!command) {
            command = await cli.ask('Enter the command to run the server:');
          }

          if (args.length === 0) {
            const argsInput = await cli.ask(
              'Enter arguments (space-separated, or press Enter for none):'
            );
            if (argsInput.trim()) {
              args = argsInput.split(/\s+/);
            }
          }

          serverConfig = {
            name,
            enabled: false,
            command: '',
            args: [],
          };
        }

        config.mcp.servers[name] = serverConfig;
        configManager.saveConfig(config);

        cli.writeSuccess(`MCP server "${name}" added.`);
        cli.writeLine(chalk.gray(`Enable it with: jindo mcp enable ${name}\n`));
      } catch (error) {
        cli.writeError(
          `Failed to add server: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }

      process.exit(0);
    }
  );

mcpCommand
  .command('enable <name>')
  .description('Enable an MCP server')
  .action((name: string) => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    if (!configManager.configExists()) {
      cli.writeError('Jindo is not initialized. Run `jindo init` first.');
      process.exit(1);
    }

    try {
      const config = configManager.getConfig();

      if (!config.mcp.servers[name]) {
        cli.writeError(`Server "${name}" not found.`);
        process.exit(1);
      }

      config.mcp.servers[name].enabled = true;
      configManager.saveConfig(config);

      cli.writeSuccess(`MCP server "${name}" enabled.`);
    } catch (error) {
      cli.writeError(
        `Failed to enable server: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

mcpCommand
  .command('disable <name>')
  .description('Disable an MCP server')
  .action((name: string) => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    if (!configManager.configExists()) {
      cli.writeError('Jindo is not initialized. Run `jindo init` first.');
      process.exit(1);
    }

    try {
      const config = configManager.getConfig();

      if (!config.mcp.servers[name]) {
        cli.writeError(`Server "${name}" not found.`);
        process.exit(1);
      }

      config.mcp.servers[name].enabled = false;
      configManager.saveConfig(config);

      cli.writeSuccess(`MCP server "${name}" disabled.`);
    } catch (error) {
      cli.writeError(
        `Failed to disable server: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

mcpCommand
  .command('remove <name>')
  .description('Remove an MCP server')
  .action(async (name: string) => {
    const configManager = new ConfigManager();
    const cli = new CLIInterface();

    if (!configManager.configExists()) {
      cli.writeError('Jindo is not initialized. Run `jindo init` first.');
      process.exit(1);
    }

    try {
      const config = configManager.getConfig();

      if (!config.mcp.servers[name]) {
        cli.writeError(`Server "${name}" not found.`);
        process.exit(1);
      }

      const confirm = await cli.confirm(`Are you sure you want to remove "${name}"?`, false);
      if (!confirm) {
        cli.writeLine('Cancelled.');
        process.exit(0);
      }

      delete config.mcp.servers[name];
      configManager.saveConfig(config);

      cli.writeSuccess(`MCP server "${name}" removed.`);
    } catch (error) {
      cli.writeError(
        `Failed to remove server: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }

    process.exit(0);
  });
