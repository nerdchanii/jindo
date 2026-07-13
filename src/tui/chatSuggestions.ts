export function filterSuggestions(
  suggestions: string[] | undefined,
  input: string,
  showSuggestions: boolean
): string[] {
  if (!showSuggestions || !suggestions) {
    return [];
  }

  const query = input.toLowerCase();
  return suggestions.filter((suggestion) => suggestion.toLowerCase().includes(query));
}

export function moveSuggestionSelection(
  currentIndex: number,
  direction: 'up' | 'down',
  suggestionCount: number
): number {
  if (suggestionCount <= 0) {
    return 0;
  }

  if (direction === 'up') {
    return Math.max(0, currentIndex - 1);
  }

  return Math.min(suggestionCount - 1, currentIndex + 1);
}

export function selectSuggestion(suggestions: string[], selectedIndex: number): string | null {
  if (selectedIndex < 0 || selectedIndex >= suggestions.length) {
    return null;
  }

  return suggestions[selectedIndex];
}
