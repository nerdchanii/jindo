import { useState } from 'react';
import { Box, Text, render } from 'ink';
import { ChatInterface, type ChatMessage } from './ChatInterface.js';
import { AgentController } from '../core/AgentController.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ModelSelector } from '../models/ModelSelector.js';

export interface TUIAppProps {
  configManager: ConfigManager;
}

export function TUIApp({ configManager }: TUIAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const suggestions = [
    '/help',
    '/clear',
    '/status',
    '/model',
    '/exit',
    'What can you help me with?',
    'Tell me about the weather',
    'Help me debug my code',
  ];

  const handleSendMessage = async (message: string) => {
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
            response = `Available commands:
/help - Show this help message
/clear - Clear chat history
/status - Show agent status
/model - Show current model information
/exit - Exit the application

You can also ask me questions about files, run commands, or get help with coding tasks.`;
            break;
          case '/clear':
            setMessages([]);
            setIsLoading(false);
            return;
          case '/status':
            const mcpSettings = configManager.getMCPSettings();
            response = `Agent Status:
- Model: ${config.agent?.conversationModel || 'Not configured'}
- Messages: ${messages.length}
- MCP Servers: ${Object.keys(mcpSettings.servers || {}).length}`;
            break;
          case '/model':
            response = `Current Model Configuration:
Conversation: ${config.agent?.conversationModel || 'Not configured'}
Function: ${config.agent?.functionModel || 'Not configured'}
Output Format: ${config.agent?.outputFormat || 'text'}`;
            break;
          case '/exit':
            process.exit(0);
            return;
          default:
            response = `Unknown command: ${message}. Type /help for available commands.`;
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Handle regular chat message with streaming
        // Add placeholder assistant message
        const placeholderMessage: ChatMessage = {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, placeholderMessage]);

        await agent.processMessage(message, {
          onChunk: (chunk: string) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: updated[lastIdx].content + chunk,
                };
              }
              return updated;
            });
          },
          onComplete: () => {
            // Streaming complete - no action needed
          },
          onError: (error: Error) => {
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
