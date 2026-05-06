import { Button, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

interface EmptyStateCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  action?: ReactNode;
}

export function EmptyStateCard({ title, description, actionLabel, action }: EmptyStateCardProps) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'xl' }}>
      <Stack gap="sm" align="center">
        <Title order={3} ta="center">
          {title}
        </Title>
        <Text c="dimmed" ta="center" maw={520}>
          {description}
        </Text>
        {action ? action : actionLabel ? <Button>{actionLabel}</Button> : null}
      </Stack>
    </Paper>
  );
}
