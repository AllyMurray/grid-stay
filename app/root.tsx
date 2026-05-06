import {
  Box,
  Code,
  ColorSchemeScript,
  Container,
  MantineProvider,
  Paper,
  Text,
  Title,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';

import type { Route } from './+types/root';
import { theme } from './theme';
import {
  colorSchemeManager,
  colorSchemeStorageKey,
  defaultColorScheme,
} from './theme/color-scheme';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/schedule/styles.css';
import './app.css';

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700&family=Manrope:wght@400..800&family=Oswald:wght@400..700&display=swap',
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <ColorSchemeScript
          defaultColorScheme={defaultColorScheme}
          localStorageKey={colorSchemeStorageKey}
        />
      </head>
      <body>
        <MantineProvider
          theme={theme}
          defaultColorScheme={defaultColorScheme}
          colorSchemeManager={colorSchemeManager}
        >
          <Notifications />
          {children}
        </MantineProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <Container component="main" py={80} size="sm">
      <Paper className="shell-card" p="xl">
        <Title order={1}>{message}</Title>
        <Text mt="sm">{details}</Text>
        {stack && (
          <Box w="100%" mt="lg" p="md" style={{ overflowX: 'auto' }}>
            <Code block>{stack}</Code>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
