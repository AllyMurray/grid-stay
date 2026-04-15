import { Group, Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface HeaderStatItem {
  label: string;
  value: ReactNode;
}

interface HeaderStatGridProps {
  items: HeaderStatItem[];
}

export function HeaderStatGrid({ items }: HeaderStatGridProps) {
  return (
    <Group gap="xs" wrap="wrap" className="page-header-stat-list">
      {items.map((item) => (
        <Group
          key={item.label}
          gap="xs"
          wrap="nowrap"
          className="page-header-stat"
        >
          <Text className="page-header-stat-value" fw={800}>
            {item.value}
          </Text>
          <Text size="sm" c="dimmed">
            {item.label}
          </Text>
        </Group>
      ))}
    </Group>
  );
}
