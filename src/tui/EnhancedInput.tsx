import { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface EnhancedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  showCharCount?: boolean;
  /** Optional hint line rendered under the input. Undefined = no hint. */
  helpText?: string;
  disabled?: boolean;
}

export function EnhancedInput({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  showCharCount = true,
  helpText,
  disabled = false,
}: EnhancedInputProps) {
  const handleSubmit = (submittedValue: string) => {
    const trimmed = submittedValue.trim();
    if (disabled || !trimmed) return;
    onSubmit(trimmed);
    // Keep the displayed value in sync with what was submitted.
    onChange('');
  };

  const handleKeyDown = useCallback(
    (input: string, key: { ctrl: boolean }) => {
      if (key.ctrl && input === 'l') {
        onChange('');
      }
    },
    [onChange]
  );

  // Ink's useInput is a global stdin listener; gate it on `disabled` so a
  // disabled field can't be cleared via Ctrl+L.
  useInput(handleKeyDown, { isActive: !disabled });

  // Count code points (not UTF-16 units) so multi-byte chars count as 1.
  const charCount = [...value].length;

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="row" alignItems="center" width="100%">
        <Box marginRight={1}>
          <Text color={disabled ? 'gray' : 'yellow'}>{disabled ? '⏸' : '▶'}</Text>
        </Box>

        <Box flexGrow={1}>
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            focus={!disabled}
          />
        </Box>

        {showCharCount && charCount > 0 && (
          <Box marginLeft={1}>
            <Text color="gray" dimColor>
              [{charCount}]
            </Text>
          </Box>
        )}
      </Box>

      {helpText && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {helpText}
          </Text>
        </Box>
      )}
    </Box>
  );
}
