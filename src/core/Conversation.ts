/**
 * Conversation Manager
 * Manages chat conversation context and history
 */

import type { ChatMessage } from '../models/types/provider.js';

/**
 * Conversation options
 */
export interface ConversationOptions {
  /** Maximum messages to keep in history */
  maxMessages?: number;
  /** System prompt for the conversation */
  systemPrompt?: string;
}

/**
 * Conversation manager for chat context
 */
export class Conversation {
  private messages: ChatMessage[] = [];
  private systemPrompt?: string;
  private maxMessages: number;
  private id: string;

  constructor(options: ConversationOptions = {}) {
    this.maxMessages = options.maxMessages || 50;
    this.systemPrompt = options.systemPrompt;
    this.id = crypto.randomUUID();
  }

  /**
   * Get conversation ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get all messages including system prompt
   */
  getMessages(includeSystem = false): ChatMessage[] {
    if (includeSystem && this.systemPrompt) {
      return [
        { role: 'system', content: this.systemPrompt },
        ...this.messages,
      ];
    }
    return [...this.messages];
  }

  /**
   * Get last N messages
   */
  getLastMessages(n: number): ChatMessage[] {
    return this.messages.slice(-n);
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Add a message to the conversation
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.trimHistory();
  }

  /**
   * Add a user message
   */
  addUserMessage(content: string): void {
    this.addMessage({ role: 'user', content });
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(content: string): void {
    this.addMessage({ role: 'assistant', content });
  }

  /**
   * Get last assistant message
   */
  getLastAssistantMessage(): ChatMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        return this.messages[i];
      }
    }
    return undefined;
  }

  /**
   * Get last user message
   */
  getLastUserMessage(): ChatMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        return this.messages[i];
      }
    }
    return undefined;
  }

  /**
   * Set or update system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Get system prompt
   */
  getSystemPrompt(): string | undefined {
    return this.systemPrompt;
  }

  /**
   * Clear conversation history (keep system prompt)
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Clear everything including system prompt
   */
  reset(): void {
    this.messages = [];
    this.systemPrompt = undefined;
  }

  /**
   * Trim history to max messages
   */
  private trimHistory(): void {
    if (this.messages.length > this.maxMessages) {
      // Remove oldest messages
      const removeCount = this.messages.length - this.maxMessages;
      this.messages = this.messages.slice(removeCount);
    }
  }

  /**
   * Get conversation summary
   */
  getSummary(): { id: string; messageCount: number; lastMessage?: ChatMessage } {
    return {
      id: this.id,
      messageCount: this.messages.length,
      lastMessage: this.messages[this.messages.length - 1],
    };
  }

  /**
   * Clone the conversation
   */
  clone(): Conversation {
    const cloned = new Conversation({
      maxMessages: this.maxMessages,
      systemPrompt: this.systemPrompt,
    });
    cloned.messages = [...this.messages];
    cloned.id = this.id;
    return cloned;
  }
}
