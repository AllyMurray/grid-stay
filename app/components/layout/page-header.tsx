import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
      <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <Text size="sm" fw={700} c="brand.7">
            {eyebrow}
          </Text>
        ) : null}
        <Title order={1}>{title}</Title>
        {description ? (
          <Text c="dimmed" maw={720}>
            {description}
          </Text>
        ) : null}
        {meta}
      </Stack>
      {actions ? <Group gap="sm">{actions}</Group> : null}
    </Group>
  );
}
