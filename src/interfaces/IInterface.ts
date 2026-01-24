/**
 * Interface abstraction for Jindo
 * Supports CLI, REPL, Web interfaces
 */

/**
 * Spinner interface for loading indicators
 */
export interface ISpinner {
  /** Start the spinner */
  start(): void;
  /** Stop the spinner */
  stop(): void;
  /** Stop with success message */
  succeed(text?: string): void;
  /** Stop with failure message */
  fail(text?: string): void;
  /** Update spinner text */
  text(text: string): void;
}

/**
 * Output format options
 */
export type OutputFormat = 'text' | 'markdown';

/**
 * Interface options
 */
export interface IInterfaceOptions {
  /** Output format */
  format?: OutputFormat;
  /** Enable verbose output */
  verbose?: boolean;
  /** Enable streaming output */
  streaming?: boolean;
}

/**
 * Main interface definition
 * All UI implementations (CLI, Web, etc.) must implement this
 */
export interface IInterface {
  /**
   * Start the interface
   */
  start(): Promise<void>;

  /**
   * Stop the interface
   */
  stop(): Promise<void>;

  /**
   * Write a line to output
   * @param message - The message to write
   */
  writeLine(message: string): void;

  /**
   * Write an error message
   * @param message - The error message
   */
  writeError(message: string): void;

  /**
   * Write a warning message
   * @param message - The warning message
   */
  writeWarning(message: string): void;

  /**
   * Write a success message
   * @param message - The success message
   */
  writeSuccess(message: string): void;

  /**
   * Write a debug message (only shown in verbose mode)
   * @param message - The debug message
   */
  writeDebug(message: string): void;

  /**
   * Write streaming output (no newline)
   * @param chunk - The chunk to write
   */
  writeStream(chunk: string): void;

  /**
   * End a streaming output (add newline)
   */
  endStream(): void;

  /**
   * Ask a question to the user
   * @param question - The question to ask
   * @returns The user's answer
   */
  ask(question: string): Promise<string>;

  /**
   * Ask for confirmation (yes/no)
   * @param question - The question to ask
   * @param defaultValue - Default value if user just presses enter
   * @returns true if confirmed, false otherwise
   */
  confirm(question: string, defaultValue?: boolean): Promise<boolean>;

  /**
   * Show a list selection
   * @param message - The message to display
   * @param choices - The choices to show
   * @returns The selected choice
   */
  select<T extends string>(message: string, choices: SelectChoice<T>[]): Promise<T>;

  /**
   * Create a spinner for loading indicators
   * @param text - Initial spinner text
   * @returns Spinner instance
   */
  spinner(text: string): ISpinner;

  /**
   * Clear the screen
   */
  clear(): void;

  /**
   * Show a table
   * @param headers - Table headers
   * @param rows - Table rows
   */
  table(headers: string[], rows: string[][]): void;

  /**
   * Show a box with content
   * @param title - Box title
   * @param content - Box content
   */
  box(title: string, content: string): void;
}

/**
 * Choice for select menus
 */
export interface SelectChoice<T extends string = string> {
  /** Display name */
  name: string;
  /** Value to return */
  value: T;
  /** Short description */
  description?: string;
  /** Whether this choice is disabled */
  disabled?: boolean;
}

/**
 * Event types for interface events
 */
export type InterfaceEventType = 'input' | 'exit' | 'interrupt' | 'resize';

/**
 * Interface event
 */
export interface InterfaceEvent {
  type: InterfaceEventType;
  data?: unknown;
}

/**
 * Interface event handler
 */
export type InterfaceEventHandler = (event: InterfaceEvent) => void | Promise<void>;
