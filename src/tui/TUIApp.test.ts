import { describe, expect, it } from 'vitest';
import { appendToLatestAssistantMessage } from './TUIApp.js';
import type { ChatMessage } from './ChatInterface.js';

describe('appendToLatestAssistantMessage', () => {
  it('appends chunk to latest assistant message and removes thinking placeholder', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello', timestamp: new Date() },
      { role: 'assistant', content: '🤔 Thinking...', timestamp: new Date() },
    ];

    const updated = appendToLatestAssistantMessage(messages, 'world');
    expect(updated[1].content).toBe('world');
  });

  it('returns original messages when latest message is not assistant', () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'hello', timestamp: new Date() }];

    const updated = appendToLatestAssistantMessage(messages, 'world');
    expect(updated).toBe(messages);
  });

  it('returns original messages when appended content is empty', () => {
    const messages: ChatMessage[] = [
      { role: 'assistant', content: 'existing', timestamp: new Date() },
    ];

    const updated = appendToLatestAssistantMessage(messages, '');
    expect(updated).toBe(messages);
  });
});
