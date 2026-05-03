import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Link } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';
import type { WhatsNewEntry } from '~/lib/whats-new';

export interface WhatsNewPageProps {
  entries: WhatsNewEntry[];
}

function WhatsNewEntryCard({
  entry,
  isLatest,
}: {
  entry: WhatsNewEntry;
  isLatest: boolean;
}) {
  const Icon = entry.icon;

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon size={42} radius="sm" color="brand" variant="light">
              <Icon size={22} />
            </ThemeIcon>
            <Stack gap={6}>
              <Group gap="xs" wrap="wrap">
                <Badge color="brand" variant="light">
                  {entry.category}
                </Badge>
                {isLatest ? (
                  <Badge color="green" variant="light">
                    Latest
                  </Badge>
                ) : null}
              </Group>
              <Title order={2} fz="h3">
                {entry.title}
              </Title>
              <Text size="sm" c="dimmed">
                {entry.dateLabel}
              </Text>
            </Stack>
          </Group>

          {entry.href && entry.actionLabel ? (
            <Button
              component={Link}
              to={entry.href}
              variant={isLatest ? 'filled' : 'default'}
              flex="0 0 auto"
            >
              {entry.actionLabel}
            </Button>
          ) : null}
        </Group>

        <Text>{entry.description}</Text>

        <Divider />

        <Stack gap={6}>
          {entry.highlights.map((highlight) => (
            <Text key={highlight} size="sm" c="dimmed">
              {highlight}
            </Text>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export function WhatsNewPage({ entries }: WhatsNewPageProps) {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Product updates"
        title="What's new"
        description="Recent Grid Stay changes in one place."
      />

      <Stack gap="md">
        {entries.map((entry, index) => (
          <WhatsNewEntryCard
            key={entry.id}
            entry={entry}
            isLatest={index === 0}
          />
        ))}
      </Stack>
    </Stack>
  );
}
