import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { colorSchemeManager, colorSchemeStorageKey, defaultColorScheme } from './color-scheme';

describe('color scheme preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to the user system preference', () => {
    expect(defaultColorScheme).toBe('auto');
    expect(colorSchemeManager.get(defaultColorScheme)).toBe('auto');
  });

  it('persists explicit theme choices in local storage', () => {
    colorSchemeManager.set('dark');

    expect(window.localStorage.getItem(colorSchemeStorageKey)).toBe('dark');
    expect(colorSchemeManager.get(defaultColorScheme)).toBe('dark');

    colorSchemeManager.set('light');

    expect(window.localStorage.getItem(colorSchemeStorageKey)).toBe('light');
    expect(colorSchemeManager.get(defaultColorScheme)).toBe('light');
  });
});
