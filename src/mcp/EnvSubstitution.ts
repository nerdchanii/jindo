/**
 * Environment variable substitution utilities
 */

const ENV_VAR_REGEX = /\$\{([^}]+)\}/g;

export interface EnvSubstitutionOptions {
  /**
   * Whether to throw error for missing variables
   * @default true
   */
  strict?: boolean;
}

/**
 * Substitute environment variables in strings
 *
 * @example
 * ```typescript
 * substituteEnvVars('Hello ${USER}!') // "Hello alice!" (if USER=alice)
 * substituteEnvVars('Path: ${HOME}/app') // "Path: /home/alice/app"
 * ```
 */
export function substituteEnvVars(input: string, options: EnvSubstitutionOptions = {}): string {
  const { strict = true } = options;

  return input.replace(ENV_VAR_REGEX, (match, varName) => {
    const envValue = process.env[varName];

    if (envValue !== undefined) {
      return envValue;
    }

    if (strict) {
      throw new Error(`Environment variable not found: ${varName}`);
    }

    // In non-strict mode, leave original placeholder
    return match;
  });
}

/**
 * Substitute environment variables in object values recursively
 */
export function substituteEnvVarsInObject<T = Record<string, unknown>>(
  obj: T,
  options: EnvSubstitutionOptions = {}
): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => substituteEnvVarsInObject(item, options)) as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = substituteEnvVars(value, options);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = substituteEnvVarsInObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Extract environment variable names from a string
 */
export function extractEnvVars(input: string): string[] {
  const matches = input.match(ENV_VAR_REGEX);
  if (!matches) return [];

  return matches.map((match) => match.slice(2, -1));
}

/**
 * Check if string contains environment variables
 */
export function hasEnvVars(input: string): boolean {
  return ENV_VAR_REGEX.test(input);
}

/**
 * Validate that all environment variables exist
 */
export function validateEnvVars(input: string): {
  valid: boolean;
  missing: string[];
} {
  const vars = extractEnvVars(input);
  const missing = vars.filter((varName) => process.env[varName] === undefined);

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get all environment variables used in a configuration object
 */
export function getUsedEnvVars(config: Record<string, unknown>): string[] {
  const allVars = new Set<string>();

  function collectVars(value: unknown): void {
    if (typeof value === 'string') {
      extractEnvVars(value).forEach((varName) => allVars.add(varName));
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.values(value).forEach(collectVars);
    }
  }

  collectVars(config);
  return Array.from(allVars);
}
