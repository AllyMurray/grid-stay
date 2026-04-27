import { describe, expect, it, vi } from 'vitest';

vi.mock('../entities/app-event.server', () => ({
  AppEventEntity: {},
}));

import type { AppEventRecord } from '../entities/app-event.server';
import {
  APP_EVENT_SCOPE,
  type AppEventPersistence,
  listRecentAppEvents,
  recordAppEvent,
} from './app-event.server';

function createMemoryStore() {
  const items: AppEventRecord[] = [];
  const store: AppEventPersistence = {
    async create(item) {
      items.push(item);
      return item;
    },
    async listAll() {
      return items;
    },
  };

  return { items, store };
}

describe('app event service', () => {
  it('records audit events with serialized metadata', async () => {
    const memory = createMemoryStore();
    const event = await recordAppEvent(
      {
        category: 'audit',
        action: 'member.invite.created',
        message: 'Member invite created.',
        actor: { userId: 'admin-1', name: 'Admin One' },
        subject: { type: 'memberInvite', id: 'driver@example.com' },
        metadata: { emailDomain: 'example.com' },
        createdAt: '2026-04-27T10:00:00.000Z',
      },
      memory.store,
    );

    expect(event).toMatchObject({
      eventScope: APP_EVENT_SCOPE,
      category: 'audit',
      severity: 'info',
      action: 'member.invite.created',
      actorUserId: 'admin-1',
      subjectId: 'driver@example.com',
      metadata: { emailDomain: 'example.com' },
    });
    expect(memory.items[0]?.metadataJson).toBe(
      JSON.stringify({ emailDomain: 'example.com' }),
    );
  });

  it('lists recent events newest first', async () => {
    const memory = createMemoryStore();

    await recordAppEvent(
      {
        category: 'operational',
        action: 'first',
        message: 'First',
        createdAt: '2026-04-27T10:00:00.000Z',
      },
      memory.store,
    );
    await recordAppEvent(
      {
        category: 'error',
        action: 'second',
        message: 'Second',
        createdAt: '2026-04-27T11:00:00.000Z',
      },
      memory.store,
    );

    await expect(listRecentAppEvents(1, memory.store)).resolves.toMatchObject([
      {
        action: 'second',
        severity: 'error',
      },
    ]);
  });
});
