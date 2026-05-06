import { localStorageColorSchemeManager, type MantineColorScheme } from '@mantine/core';

export const defaultColorScheme: MantineColorScheme = 'auto';
export const colorSchemeStorageKey = 'grid-stay-color-scheme';

export const colorSchemeManager = localStorageColorSchemeManager({
  key: colorSchemeStorageKey,
});
