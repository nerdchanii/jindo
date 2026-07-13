import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { filterSuggestions, moveSuggestionSelection, selectSuggestion } from './chatSuggestions.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  suggestions?: string[];
}

interface MessagesListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

const MessagesList = memo(function MessagesList({ messages, isLoading }: MessagesListProps) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((message, index) => (
        <Box key={index} marginBottom={1}>
          <Text
            color={
              message.role === 'user' ? 'blue' : message.role === 'assistant' ? 'green' : 'gray'
            }
          >
            {message.role === 'user'
              ? 'You'
              : message.role === 'assistant'
                ? 'Assistant'
                : 'System'}
            :{' '}
          </Text>
          <Text>{message.content}</Text>
        </Box>
      ))}
      {isLoading && (
        <Box>
          <Text color="yellow">Assistant is typing...</Text>
        </Box>
      )}
    </Box>
  );
});

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  suggestions,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  const handleSubmit = useCallback(
    (value: string) => {
      if (value.trim()) {
        onSendMessage(value.trim());
        setInput('');
        setShowSuggestions(false);
        setSelectedSuggestion(0);
      }
    },
    [onSendMessage]
  );

  useInput((_input, key) => {
    if (key.escape) {
      setShowSuggestions(false);
      setSelectedSuggestion(0);
    } else if (key.tab && suggestions && suggestions.length > 0) {
      // Tab completion
      setShowSuggestions(!showSuggestions);
    } else if (showSuggestions && (key.upArrow || key.downArrow)) {
      // Navigate suggestions
      const filteredSuggestions = filterSuggestions(suggestions, input, true);
      if (key.upArrow) {
        setSelectedSuggestion(
          moveSuggestionSelection(selectedSuggestion, 'up', filteredSuggestions.length)
        );
      } else if (key.downArrow) {
        setSelectedSuggestion(
          moveSuggestionSelection(selectedSuggestion, 'down', filteredSuggestions.length)
        );
      }
    } else if (showSuggestions && key.return) {
      // Select suggestion
      const filteredSuggestions = filterSuggestions(suggestions, input, true);
      const selectedValue = selectSuggestion(filteredSuggestions, selectedSuggestion);
      if (selectedValue) {
        setInput(selectedValue);
        setShowSuggestions(false);
        setSelectedSuggestion(0);
      }
    }
  });

  const currentSuggestions = useMemo(() => {
    return filterSuggestions(suggestions, input, showSuggestions);
  }, [showSuggestions, suggestions, input]);

  useEffect(() => {
    setSelectedSuggestion((prev) => {
      if (currentSuggestions.length === 0) {
        return 0;
      }

      return Math.min(prev, currentSuggestions.length - 1);
    });
  }, [currentSuggestions.length]);

  return (
    <Box flexDirection="column" height="100%">
      {/* Messages area */}
      <MessagesList messages={messages} isLoading={isLoading} />

      {/* Input area */}
      <Box flexDirection="column" borderStyle="single" paddingX={1}>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type your message... (Tab for autocomplete, Esc to cancel, Ctrl+C to exit)"
        />

        {/* Suggestions dropdown */}
        {showSuggestions && currentSuggestions.length > 0 && (
          <Box flexDirection="column" borderStyle="single" marginTop={1}>
            {currentSuggestions.map((suggestion, index) => (
              <Box key={suggestion}>
                <Text
                  color={index === selectedSuggestion ? 'blue' : 'white'}
                  backgroundColor={index === selectedSuggestion ? 'gray' : undefined}
                >
                  {index === selectedSuggestion ? '▶ ' : '  '}
                  {suggestion}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
