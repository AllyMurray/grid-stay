import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconDeviceFloppy, IconTrash } from '@tabler/icons-react';
import { useFetcher } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { AdminCircuitActionResult, AdminCircuitsReport } from '~/lib/admin/circuits.server';

export type AdminCircuitsPageProps = AdminCircuitsReport;
type CircuitAliasFieldErrors = Extract<AdminCircuitActionResult, { ok: false }>['fieldErrors'];

function formatAliasTarget(alias: AdminCircuitsReport['aliases'][number]) {
  return [alias.canonicalCircuit, alias.canonicalLayout].filter(Boolean).join(' ');
}

function formatCircuitLabel(circuit: AdminCircuitsReport['circuits'][number]) {
  return [circuit.circuit, circuit.layout].filter(Boolean).join(' ');
}

function getFieldError(
  fieldErrors: CircuitAliasFieldErrors | undefined,
  fieldName: keyof CircuitAliasFieldErrors,
) {
  return fieldErrors?.[fieldName]?.[0];
}

export function AdminCircuitsPage({
  circuits,
  aliases,
  unknownCircuitCount,
}: AdminCircuitsPageProps) {
  const fetcher = useFetcher<AdminCircuitActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors = fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok ? fetcher.data : null;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Circuit tools"
        description="Review canonical circuit labels and map source-specific names to the shared circuit list."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Circuits', value: circuits.length },
              { label: 'Aliases', value: aliases.length },
              { label: 'Unknown', value: unknownCircuitCount },
            ]}
          />
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Add circuit alias</Title>
            <Text size="sm" c="dimmed">
              Store source labels that should resolve to an existing circuit and optional layout.
            </Text>
          </Stack>

          {success ? (
            <Alert color="green" variant="light">
              {success.message}
            </Alert>
          ) : formError ? (
            <Alert color="red" variant="light">
              {formError}
            </Alert>
          ) : null}

          <fetcher.Form method="post">
            <Stack gap="md">
              <Group align="flex-start" gap="md" wrap="wrap">
                <TextInput
                  name="rawCircuit"
                  label="Source circuit"
                  placeholder="Sntterton 300"
                  error={getFieldError(fieldErrors, 'rawCircuit')}
                  style={{ flex: 1, minWidth: 220 }}
                />
                <TextInput
                  name="rawLayout"
                  label="Source layout"
                  placeholder="300"
                  error={getFieldError(fieldErrors, 'rawLayout')}
                  w={160}
                />
                <TextInput
                  name="canonicalCircuit"
                  label="Canonical circuit"
                  placeholder="Snetterton"
                  error={getFieldError(fieldErrors, 'canonicalCircuit')}
                  style={{ flex: 1, minWidth: 220 }}
                />
                <TextInput
                  name="canonicalLayout"
                  label="Canonical layout"
                  placeholder="300"
                  error={getFieldError(fieldErrors, 'canonicalLayout')}
                  w={170}
                />
              </Group>
              <TextInput
                name="note"
                label="Note"
                placeholder="Caterham import alias"
                error={getFieldError(fieldErrors, 'note')}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  name="intent"
                  value="saveAlias"
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={isSubmitting}
                >
                  Save alias
                </Button>
              </Group>
            </Stack>
          </fetcher.Form>
        </Stack>
      </Paper>

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Configured aliases</Title>
            <Text size="sm" c="dimmed">
              Aliases are applied during feed refresh before the available-day cache is saved.
            </Text>
          </Stack>

          {aliases.length > 0 ? (
            <Stack gap="md">
              {aliases.map((alias) => (
                <fetcher.Form method="post" key={alias.aliasKey}>
                  <Group justify="space-between" gap="md" wrap="wrap">
                    <Stack gap={2} style={{ flex: 1, minWidth: 220 }}>
                      <Text fw={700}>{alias.rawCircuit}</Text>
                      <Text size="sm" c="dimmed">
                        {alias.rawLayout ? `Layout ${alias.rawLayout} • ` : ''}
                        Maps to {formatAliasTarget(alias)}
                      </Text>
                      {alias.note ? (
                        <Text size="xs" c="dimmed">
                          {alias.note}
                        </Text>
                      ) : null}
                    </Stack>
                    <input type="hidden" name="aliasKey" value={alias.aliasKey} />
                    <Button
                      type="submit"
                      name="intent"
                      value="deleteAlias"
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      loading={isSubmitting}
                    >
                      Remove
                    </Button>
                  </Group>
                </fetcher.Form>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No circuit aliases have been configured.
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Current circuit labels</Title>
            <Text size="sm" c="dimmed">
              Circuits currently present in the available-days feed.
            </Text>
          </Stack>

          {circuits.length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover miw={760}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Circuit</Table.Th>
                    <Table.Th>Known</Table.Th>
                    <Table.Th>Days</Table.Th>
                    <Table.Th>Providers</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {circuits.map((circuit) => (
                    <Table.Tr key={`${circuit.circuit}:${circuit.layout ?? ''}`}>
                      <Table.Td>{formatCircuitLabel(circuit)}</Table.Td>
                      <Table.Td>
                        <Badge color={circuit.circuitKnown ? 'green' : 'yellow'} variant="light">
                          {circuit.circuitKnown ? 'Known' : 'Unknown'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{circuit.dayCount}</Table.Td>
                      <Table.Td>{circuit.providers.join(', ')}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text size="sm" c="dimmed">
              No available days are cached yet.
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
