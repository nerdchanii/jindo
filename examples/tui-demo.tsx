#!/usr/bin/env node

/**
 * TUI Demo Script
 * Demonstrates Jindo TUI features without requiring full setup
 */

import { render } from 'ink';
import React from 'react';
import { Box, Text, useInput } from 'ink';

function DemoApp() {
  const [currentDemo, setCurrentDemo] = React.useState('menu');

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      process.exit(0);
    }

    if (key.return) {
      setCurrentDemo('tui-preview');
    }
  });

  if (currentDemo === 'menu') {
    return (
      <Box flexDirection="column" alignItems="center" height="100%" justifyContent="center">
        <Box flexDirection="column" alignItems="center" marginBottom={2}>
          <Text bold color="blue">
            🐕 Jindo TUI Demo
          </Text>
          <Text color="gray">Modern Terminal UI for AI Agents</Text>
        </Box>

        <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
          <Text color="cyan">✨ TUI Features:</Text>
          <Text>• React-based terminal UI</Text>
          <Text>• Autocomplete with Tab</Text>
          <Text>• Real-time streaming</Text>
          <Text>• Slash commands</Text>
          <Text>• Keyboard navigation</Text>
        </Box>

        <Box marginTop={2}>
          <Text color="yellow">Press Enter to see TUI preview, Esc to exit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="double" paddingX={1} marginBottom={1}>
        <Text bold color="blue">
          🐕 Jindo - Local AI Assistant (TUI Mode)
        </Text>
      </Box>

      {/* Messages area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box key={0} marginBottom={1}>
          <Text color="blue">You: </Text>
          <Text>/status</Text>
        </Box>

        <Box key={1} marginBottom={1}>
          <Text color="green">Assistant: </Text>
          <Text>
            📊 Agent Status 🤖 Model: ollama:llama3.2:3b 💬 Messages: 1 🔌 MCP Servers: 0 enabled 📚
            Providers: 0
          </Text>
        </Box>
      </Box>

      {/* Input area */}
      <Box flexDirection="column" borderStyle="single" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            Tab: Suggestions • Ctrl+C: Clear • Esc: Cancel
          </Text>
        </Box>
        <Text color="gray">Message... (Tab for autocomplete)_</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press Esc to exit demo
        </Text>
      </Box>
    </Box>
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { unmount } = render(<DemoApp />);

  process.on('SIGINT', () => {
    unmount();
    process.exit(0);
  });
}

export { DemoApp };
