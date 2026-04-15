import {
  Badge,
  Button,
  Card,
  createTheme,
  Paper,
  Select,
  Textarea,
  TextInput,
} from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'brand',
  colors: {
    brand: [
      '#fff1f2',
      '#ffe2e7',
      '#ffc9d3',
      '#ff9eb2',
      '#ff6f8f',
      '#fb456f',
      '#e42a57',
      '#c11a46',
      '#a1163d',
      '#871538',
    ],
  },
  defaultRadius: 'sm',
  fontFamily: 'Manrope, sans-serif',
  headings: {
    fontFamily: 'Oswald, sans-serif',
    fontWeight: '700',
  },
  fontFamilyMonospace: 'JetBrains Mono, monospace',
  components: {
    Button: Button.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'sm',
        withBorder: true,
      },
    }),
    Paper: Paper.extend({
      defaultProps: {
        radius: 'sm',
        withBorder: true,
      },
    }),
    Badge: Badge.extend({
      defaultProps: {
        radius: 'sm',
        variant: 'light',
      },
    }),
    TextInput: TextInput.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    Select: Select.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    Textarea: Textarea.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
  },
});
