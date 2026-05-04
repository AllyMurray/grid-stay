import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconLinkOff, IconRoad } from '@tabler/icons-react';
import { Link } from 'react-router';

export type JoinLinkFailureReason =
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'full';

export interface JoinLinkPageProps {
  reason: JoinLinkFailureReason;
}

const messages: Record<JoinLinkFailureReason, string> = {
  not_found: 'This join link is not valid.',
  revoked: 'This join link has been revoked.',
  expired: 'This join link has expired.',
  full: 'This join link has already reached its usage limit.',
};

export function JoinLinkPage({ reason }: JoinLinkPageProps) {
  return (
    <Box className="auth-login-shell">
      <Container size="xs" className="auth-login-container">
        <Stack className="auth-login-stage" justify="center" align="center">
          <Paper className="auth-login-panel" radius="sm" p="xl" shadow="xl">
            <Stack gap="lg">
              <Stack gap="sm" align="flex-start">
                <ThemeIcon size={44} radius="sm" variant="light" color="brand">
                  <IconRoad size={22} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Title order={1} size="h2">
                    Grid Stay
                  </Title>
                  <Text c="dimmed" size="sm">
                    Join link unavailable
                  </Text>
                </Stack>
              </Stack>

              <Alert color="red" icon={<IconLinkOff size={16} />}>
                {messages[reason]}
              </Alert>

              <Button component={Link} to="/auth/login" fullWidth>
                Sign in
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
