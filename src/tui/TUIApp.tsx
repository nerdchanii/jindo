import React, { useState } from 'react';
import { Box, Text, render } from 'ink';
import { ChatInterface, type ChatMessage } from './ChatInterface.js';
import { AgentController } from '../core/AgentController.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ModelSelector } from '../models/ModelSelector.js';

export interface TUIAppProps {
  configManager: ConfigManager;
}

export function appendToLatestAssistantMessage(
  messages: ChatMessage[],
  appendedContent: string
): ChatMessage[] {
  if (!appendedContent) {
    return messages;
  }

  const updated = [...messages];
  const lastIndex = updated.length - 1;

  if (lastIndex < 0 || updated[lastIndex].role !== 'assistant') {
    return messages;
  }

  const currentContent = updated[lastIndex].content.replace('🤔 Thinking...', '');
  updated[lastIndex] = {
    ...updated[lastIndex],
    content: currentContent + appendedContent,
  };

  return updated;
}

export function TUIApp({ configManager }: TUIAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const config = configManager.getConfig();
  const [agent] = useState(
    () =>
      new AgentController({
        config: {
          modelSelector: new ModelSelector({
            conversationModel: config.agent.conversationModel,
            functionModel: config.agent.functionModel,
            providers: config.agent.providers || {},
          }),
          maxHistoryMessages: config.agent.maxHistoryMessages || 50,
        },
        configManager,
        streaming: true,
      })
  );

  // Initialize agent on mount
  React.useEffect(() => {
    const initializeAgent = async () => {
      try {
        await agent.initialize();
        const ready = await agent.isReady();
        if (!ready) {
          setInitError('Agent not ready. Make sure Ollama is running and models are installed.');
        }
      } catch (error) {
        setInitError(
          `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAgent();
  }, [agent]);

  const suggestions = [
    '/help',
    '/clear',
    '/status',
    '/model',
    '/mcp',
    '/providers',
    '/exit',
    'What can you help me with?',
    'Help me debug this code',
    'Explain this concept',
    'Write a function to...',
  ];

  const handleSendMessage = async (message: string) => {
    if (isInitializing || initError) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Check if it's a slash command
      if (message.startsWith('/')) {
        // Handle slash commands
        let response: string;
        const config = configManager.getConfig();

        switch (message) {
          case '/help':
            response = `🐕 Jindo TUI Commands

💬 Chat Commands:
  /help     • Show this help message
  /clear    • Clear chat history  
  /exit     • Exit application

📊 Status Commands:
  /status   • Show agent status
  /model    • Show current model info
  /mcp      • Show MCP server status
  /providers• Show configured providers

🎯 Usage Tips:
  • Tab activates autocomplete
  • ↑↓ navigates suggestions
  • Ctrl+C clears input
  • Esc cancels suggestions

You can ask me about files, run commands, or get coding help!`;
            break;
          case '/clear':
            setMessages([]);
            // Add a confirmation message instead of just returning
            const clearMessage: ChatMessage = {
              role: 'assistant',
              content: 'Chat history cleared. Ready for new conversation!',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, clearMessage]);
            setIsLoading(false);
            return;
          case '/status':
            const mcpSettings = configManager.getMCPSettings();
            const enabledServers = Object.entries(mcpSettings.servers || {})
              .filter(([, config]) => config.enabled)
              .map(([name]) => name);
            response = `📊 Agent Status

🤖 Model: ${config.agent?.conversationModel || 'Not configured'}
💬 Messages: ${messages.length}
🔌 MCP Servers: ${enabledServers.length} enabled
  ${enabledServers.length > 0 ? enabledServers.map((s) => `  • ${s}`).join('\n') : '  (none enabled)'}
📚 Providers: ${Object.keys(config.agent?.providers || {}).length}`;
            break;
          case '/model':
            response = `🤖 Current Model Configuration

Conversation: ${config.agent?.conversationModel || 'Not configured'}
Function: ${config.agent?.functionModel || 'Not configured'}
Output Format: ${config.agent?.outputFormat || 'text'}
Max History: ${config.agent?.maxHistoryMessages || 50} messages`;
            break;
          case '/mcp':
            const mcpConfig = configManager.getMCPSettings();
            const servers = Object.entries(mcpConfig.servers || {});
            if (servers.length === 0) {
              response =
                '🔌 No MCP servers configured.\n\nUse "jindo mcp add <server>" to add servers.';
            } else {
              response = `🔌 MCP Servers\n\n${servers
                .map(
                  ([name, server]) =>
                    `${server.enabled ? '✅' : '❌'} ${name}\n   Command: ${server.command} ${server.args?.join(' ') || ''}`
                )
                .join('\n\n')}`;
            }
            break;
          case '/providers':
            const providers = config.agent?.providers || {};
            const providerList = Object.entries(providers);
            if (providerList.length === 0) {
              response =
                '📚 No external providers configured.\n\nOnly Ollama (local) is available.';
            } else {
              response = `📚 Configured Providers\n\n${providerList
                .map(([name, _]) => `• ${name}`)
                .join('\n')}

💡 Use "jindo provider set <provider>:key=value" to configure`;
            }
            break;
          case '/exit':
            process.exit(0);
            return;
          default:
            response = `❓ Unknown command: ${message}\n💡 Type /help for available commands.`;
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Handle regular chat message with streaming
        // Add placeholder assistant message with typing indicator
        const placeholderMessage: ChatMessage = {
          role: 'assistant',
          content: '🤔 Thinking...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, placeholderMessage]);

        // Debounce streaming updates to reduce flicker
        let updateBuffer = '';
        let updateTimeout: NodeJS.Timeout | null = null;

        await agent.processMessage(message, {
          onChunk: (chunk: string) => {
            updateBuffer += chunk;

            // Debug logging (remove in production)
            if (process.env.DEBUG === '1') {
              console.log(`[DEBUG] Received chunk: "${chunk}"`);
              console.log(`[DEBUG] Buffer length: ${updateBuffer.length}`);
            }

            // Clear existing timeout
            if (updateTimeout) {
              clearTimeout(updateTimeout);
            }

            // Batch updates every 50ms for smoother streaming
            updateTimeout = setTimeout(() => {
              setMessages((prev) => appendToLatestAssistantMessage(prev, updateBuffer));
              updateBuffer = '';
            }, 50);
          },
          onComplete: () => {
            // Clear any pending buffer and timeout
            if (updateTimeout) {
              clearTimeout(updateTimeout);
              updateTimeout = null;
            }

            if (updateBuffer) {
              setMessages((prev) => appendToLatestAssistantMessage(prev, updateBuffer));
              updateBuffer = '';
            }

            // Force a final update to ensure complete rendering
            setMessages((prev) => [...prev]);
          },
          onError: (error: Error) => {
            // Clear any pending buffer and timeout
            if (updateTimeout) {
              clearTimeout(updateTimeout);
              updateTimeout = null;
            }

            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: `Error: ${error.message}`,
                };
              }
              return updated;
            });
          },
        });
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <Box flexDirection="column" justifyContent="center" alignItems="center" height="100%">
        <Text color="yellow">Initializing Jindo...</Text>
      </Box>
    );
  }

  if (initError) {
    return (
      <Box flexDirection="column" justifyContent="center" alignItems="center" height="100%">
        <Text color="red">Error: {initError}</Text>
        <Text color="gray">Press Ctrl+C to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="double" paddingX={1} marginBottom={1}>
        <Text bold color="blue">
          🐕 Jindo - Local AI Assistant (TUI Mode)
        </Text>
      </Box>

      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        suggestions={suggestions}
      />
    </Box>
  );
}

// Helper function to render the TUI app
export function startTUI(configManager: ConfigManager) {
  const { unmount } = render(<TUIApp configManager={configManager} />);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    unmount();
    process.exit(0);
  });

  return unmount;
}
