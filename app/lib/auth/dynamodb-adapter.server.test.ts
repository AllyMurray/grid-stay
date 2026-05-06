import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vite-plus/test';
import { dynamoDBAdapter } from './dynamodb-adapter.server';

function createAdapterWithSend(send: ReturnType<typeof vi.fn>) {
  return dynamoDBAdapter({
    client: { send } as never,
    tableName: 'auth-table',
  })({} as never);
}

describe('dynamoDBAdapter', () => {
  it('finds existing Gmail users by member-access alias when OAuth email differs by dots', async () => {
    const send = vi.fn(async (command) => {
      if (command instanceof QueryCommand) {
        return { Items: [] };
      }

      if (command instanceof ScanCommand) {
        return {
          Items: [
            {
              pk: 'USER#user-1',
              sk: 'USER',
              id: 'user-1',
              email: 'mulholland.william@gmail.com',
              name: 'William Mulholland',
              createdAt: '2026-05-03T11:25:30.268Z',
            },
          ],
        };
      }

      throw new Error('Unexpected command');
    });

    const adapter = createAdapterWithSend(send);

    await expect(
      adapter.findOne({
        model: 'user',
        where: [{ field: 'email', value: 'mulhollandwilliam@gmail.com' }],
      }),
    ).resolves.toMatchObject({
      id: 'user-1',
      email: 'mulholland.william@gmail.com',
    });

    expect(send.mock.calls.map(([command]) => command.constructor.name)).toEqual([
      'QueryCommand',
      'ScanCommand',
    ]);
  });

  it('does not scan for non-Gmail email misses', async () => {
    const send = vi.fn(async (command) => {
      if (command instanceof QueryCommand) {
        return { Items: [] };
      }

      throw new Error('Unexpected command');
    });

    const adapter = createAdapterWithSend(send);

    await expect(
      adapter.findOne({
        model: 'user',
        where: [{ field: 'email', value: 'driver@example.com' }],
      }),
    ).resolves.toBeNull();

    expect(send.mock.calls.map(([command]) => command.constructor.name)).toEqual(['QueryCommand']);
  });
});
