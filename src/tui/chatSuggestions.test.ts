import { describe, expect, it } from 'vitest';
import { filterSuggestions, moveSuggestionSelection, selectSuggestion } from './chatSuggestions.js';

describe('chatSuggestions', () => {
  describe('filterSuggestions', () => {
    it('returns empty list when suggestions are hidden', () => {
      const result = filterSuggestions(['/help', '/status'], '/h', false);
      expect(result).toEqual([]);
    });

    it('filters suggestions case-insensitively', () => {
      const result = filterSuggestions(['/Help', '/status', 'Hello world'], 'he', true);
      expect(result).toEqual(['/Help', 'Hello world']);
    });
  });

  describe('moveSuggestionSelection', () => {
    it('keeps lower bound at zero', () => {
      const result = moveSuggestionSelection(0, 'up', 3);
      expect(result).toBe(0);
    });

    it('keeps upper bound at suggestion count minus one', () => {
      const result = moveSuggestionSelection(2, 'down', 3);
      expect(result).toBe(2);
    });
  });

  describe('selectSuggestion', () => {
    it('returns selected suggestion when index is valid', () => {
      const result = selectSuggestion(['/help', '/status'], 1);
      expect(result).toBe('/status');
    });

    it('returns null when index is out of range', () => {
      const result = selectSuggestion(['/help'], 4);
      expect(result).toBeNull();
    });
  });
});
