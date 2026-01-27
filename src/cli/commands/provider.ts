import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../config/ConfigManager.js';

function listProviders(config: any) {
  console.log(chalk.cyan('\n🔧 Configured Providers:\n'));

  const providers = config.agent?.providers || {};

  if (Object.keys(providers).length === 0) {
    console.log(chalk.yellow('  No providers configured. Using Ollama as default.\n'));
    console.log(chalk.gray('Available providers: openai, anthropic, groq, ollama'));
    console.log(chalk.gray('Example: jindo provider --set openai:apiKey=your_key_here'));
    return;
  }

  for (const [name, providerConfig] of Object.entries(providers)) {
    console.log(chalk.green(`  ${name}:`));
    const config = providerConfig as any;
    if (config.apiKey) {
      console.log(chalk.gray(`    API Key: ${config.apiKey.substring(0, 8)}...`));
    }
    if (config.baseUrl) {
      console.log(chalk.gray(`    Base URL: ${config.baseUrl}`));
    }
    if (config.options) {
      console.log(chalk.gray(`    Options: ${JSON.stringify(config.options, null, 2)}`));
    }
    console.log('');
  }
}

function showProvider(config: any, providerName: string) {
  const providers = config.agent?.providers || {};
  const providerConfig = providers[providerName];

  if (!providerConfig) {
    console.error(chalk.red(`✗ Provider '${providerName}' not found.`));
    console.log(chalk.gray('Use --list to see available providers.'));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n🔧 ${providerName} Provider Configuration:\n`));
  console.log(chalk.white(JSON.stringify(providerConfig, null, 2)));
}

function setProviderConfig(config: any, configManager: ConfigManager, setCommand: string) {
  const [provider, keyValue] = setCommand.split(':', 2);

  if (!provider || !keyValue) {
    console.error(chalk.red('✗ Invalid format. Use: provider:key=value'));
    console.log(chalk.gray('Example: jindo provider --set openai:apiKey=your_key_here'));
    process.exit(1);
  }

  const [key, value] = keyValue.split('=', 2);

  if (!key || value === undefined) {
    console.error(chalk.red('✗ Invalid format. Use: provider:key=value'));
    process.exit(1);
  }

  const updatedConfig = {
    ...config,
    agent: {
      ...config.agent,
      providers: {
        ...(config.agent?.providers || {}),
        [provider]: {
          ...(config.agent?.providers?.[provider] || {}),
          [key]: value,
        },
      },
    },
  };

  configManager.saveConfig(updatedConfig);
  console.log(chalk.green(`✓ Set ${provider}.${key} = ${value}`));
}

function removeProvider(config: any, configManager: ConfigManager, providerName: string) {
  const providers = config.agent?.providers || {};

  if (!providers[providerName]) {
    console.error(chalk.red(`✗ Provider '${providerName}' not found.`));
    console.log(chalk.gray('Use --list to see available providers.'));
    process.exit(1);
  }

  const updatedConfig = {
    ...config,
    agent: {
      ...config.agent,
      providers: Object.fromEntries(
        Object.entries(providers).filter(([name]) => name !== providerName)
      ),
    },
  };

  configManager.saveConfig(updatedConfig);
  console.log(chalk.green(`✓ Removed provider '${providerName}'`));
}

function showProviderHelp() {
  console.log(chalk.cyan('🔧 Provider Management\n'));
  console.log('Usage:');
  console.log('  jindo provider --list              List all providers');
  console.log('  jindo provider --show <provider>      Show provider config');
  console.log('  jindo provider --set <provider:key=value>  Set provider config');
  console.log('  jindo provider --remove <provider>   Remove provider\n');
  console.log(chalk.gray('Available providers: openai, anthropic, groq, ollama'));
}

export const providerCommand = new Command('provider')
  .description('Manage model providers')
  .option('-l, --list', 'List all configured providers')
  .option('-s, --set <provider>', 'Set provider configuration (provider:key=value)')
  .option('-r, --remove <provider>', 'Remove provider configuration')
  .option('--show <provider>', 'Show provider configuration')
  .action(async (options: { list?: boolean; set?: string; remove?: string; show?: string }) => {
    const configManager = new ConfigManager();

    if (!configManager.configExists()) {
      console.error(chalk.red('✗ Jindo is not initialized.'));
      console.log(chalk.gray('Run `jindo init` to set up your configuration.'));
      process.exit(1);
    }

    const config = configManager.getConfig();

    if (options.list) {
      listProviders(config);
      return;
    }

    if (options.show) {
      showProvider(config, options.show);
      return;
    }

    if (options.set) {
      setProviderConfig(config, configManager, options.set);
      return;
    }

    if (options.remove) {
      removeProvider(config, configManager, options.remove);
      return;
    }

    showProviderHelp();
  });
