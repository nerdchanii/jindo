import { describe, it, expect, beforeEach } from 'vitest';
import { Conversation } from './Conversation.js';

describe('Conversation', () => {
  let conversation: Conversation;

  beforeEach(() => {
    conversation = new Conversation({ maxMessages: 5 });
  });

  describe('constructor', () => {
    it('should create unique ID', () => {
      const conv1 = new Conversation();
      const conv2 = new Conversation();
      expect(conv1.getId()).not.toBe(conv2.getId());
    });

    it('should set default maxMessages to 50', () => {
      const conv = new Conversation();
      expect(conv.getMessageCount()).toBe(0);
    });

    it('should set custom maxMessages', () => {
      const conv = new Conversation({ maxMessages: 10 });
      conv.addUserMessage('test');
      expect(conv.getMessageCount()).toBe(1);
    });

    it('should set system prompt', () => {
      const conv = new Conversation({ systemPrompt: 'You are a helpful assistant' });
      expect(conv.getSystemPrompt()).toBe('You are a helpful assistant');
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation', () => {
      conversation.addMessage({ role: 'user', content: 'Hello' });
      expect(conversation.getMessageCount()).toBe(1);
    });

    it('should trim history when exceeding maxMessages', () => {
      for (let i = 0; i < 10; i++) {
        conversation.addUserMessage(`Message ${i}`);
      }
      expect(conversation.getMessageCount()).toBe(5);
    });
  });

  describe('addUserMessage', () => {
    it('should add user message', () => {
      conversation.addUserMessage('Hello');
      const messages = conversation.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
    });
  });

  describe('addAssistantMessage', () => {
    it('should add assistant message', () => {
      conversation.addAssistantMessage('Hi there!');
      const messages = conversation.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });
  });

  describe('getMessages', () => {
    it('should return all messages without system', () => {
      conversation.addUserMessage('Hello');
      conversation.addAssistantMessage('Hi');
      const messages = conversation.getMessages();
      expect(messages).toHaveLength(2);
    });

    it('should include system prompt when requested', () => {
      const conv = new Conversation({ systemPrompt: 'System' });
      conv.addUserMessage('Hello');
      const messages = conv.getMessages(true);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'system', content: 'System' });
    });
  });

  describe('getLastMessages', () => {
    it('should return last N messages', () => {
      conversation.addUserMessage('Message 1');
      conversation.addAssistantMessage('Response 1');
      conversation.addUserMessage('Message 2');
      conversation.addAssistantMessage('Response 2');
      conversation.addUserMessage('Message 3');
      
      const last2 = conversation.getLastMessages(2);
      expect(last2).toHaveLength(2);
      expect(last2[0].content).toBe('Response 2');
    });

    it('should return all if N exceeds count', () => {
      conversation.addUserMessage('Test');
      const last10 = conversation.getLastMessages(10);
      expect(last10.length).toBeLessThanOrEqual(conversation.getMessageCount());
    });
  });

  describe('getLastAssistantMessage', () => {
    it('should return last assistant message', () => {
      conversation.addUserMessage('Hello');
      conversation.addAssistantMessage('Hi');
      conversation.addUserMessage('How are you?');
      conversation.addAssistantMessage('Good!');
      
      const last = conversation.getLastAssistantMessage();
      expect(last).toBeDefined();
      expect(last?.content).toBe('Good!');
    });

    it('should return undefined if no assistant message', () => {
      conversation.addUserMessage('Hello');
      const last = conversation.getLastAssistantMessage();
      expect(last).toBeUndefined();
    });
  });

  describe('getLastUserMessage', () => {
    it('should return last user message', () => {
      conversation.addUserMessage('Hello');
      conversation.addAssistantMessage('Hi');
      conversation.addUserMessage('How are you?');
      conversation.addAssistantMessage('Good!');
      
      const last = conversation.getLastUserMessage();
      expect(last).toBeDefined();
      expect(last?.content).toBe('How are you?');
    });
  });

  describe('system prompt', () => {
    it('should set system prompt', () => {
      conversation.setSystemPrompt('New system prompt');
      expect(conversation.getSystemPrompt()).toBe('New system prompt');
    });
  });

  describe('clear', () => {
    it('should clear messages but keep system prompt', () => {
      const conv = new Conversation({ systemPrompt: 'System' });
      conv.addUserMessage('Hello');
      conv.clear();
      expect(conv.getMessageCount()).toBe(0);
      expect(conv.getSystemPrompt()).toBe('System');
    });
  });

  describe('reset', () => {
    it('should clear everything including system prompt', () => {
      const conv = new Conversation({ systemPrompt: 'System' });
      conv.addUserMessage('Hello');
      conv.reset();
      expect(conv.getMessageCount()).toBe(0);
      expect(conv.getSystemPrompt()).toBeUndefined();
    });
  });

  describe('getSummary', () => {
    it('should return conversation summary', () => {
      conversation.addUserMessage('Hello');
      conversation.addAssistantMessage('Hi');
      
      const summary = conversation.getSummary();
      expect(summary.messageCount).toBe(2);
      expect(summary.lastMessage).toEqual({ role: 'assistant', content: 'Hi' });
      expect(summary.id).toBeDefined();
    });
  });

  describe('clone', () => {
    it('should create independent clone', () => {
      const conv1 = new Conversation({ systemPrompt: 'System' });
      conv1.addUserMessage('Hello');
      conv1.addAssistantMessage('Hi');
      
      const conv2 = conv1.clone();
      conv2.addUserMessage('New message');
      
      expect(conv1.getMessageCount()).toBe(2);
      expect(conv2.getMessageCount()).toBe(3);
      expect(conv1.getId()).toBe(conv2.getId());
      expect(conv1.getSystemPrompt()).toBe(conv2.getSystemPrompt());
    });
  });
});
