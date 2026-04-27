import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/db/entities/calendar-feed.server', () => ({
  CalendarFeedEntity: {},
}));

import type { CalendarFeedRecord } from '~/lib/db/entities/calendar-feed.server';
import {
  type CalendarFeedPersistence,
  ensureCalendarFeedForUser,
  getActiveCalendarFeedByToken,
  hashCalendarFeedToken,
  regenerateCalendarFeedForUser,
} from './feed.server';

function createMemoryStore() {
  const items: CalendarFeedRecord[] = [];
  const store: CalendarFeedPersistence = {
    async create(item) {
      items.push(item);
      return item;
    },
    async update(tokenHash, feedScope, changes) {
      const item = items.find(
        (feed) => feed.tokenHash === tokenHash && feed.feedScope === feedScope,
      );

      if (!item) {
        throw new Error('Feed not found');
      }

      Object.assign(item, changes);
      return item;
    },
    async getByTokenHash(tokenHash) {
      return items.find((feed) => feed.tokenHash === tokenHash) ?? null;
    },
    async listByUser(userId) {
      return items.filter((feed) => feed.userId === userId);
    },
  };

  return { items, store };
}

describe('calendar feed service', () => {
  it('creates a private feed once and returns the active feed afterwards', async () => {
    const memory = createMemoryStore();
    const first = await ensureCalendarFeedForUser(
      'user-1',
      memory.store,
      () => 'first-token',
    );
    const second = await ensureCalendarFeedForUser(
      'user-1',
      memory.store,
      () => 'second-token',
    );

    expect(second).toBe(first);
    expect(memory.items).toHaveLength(1);
    expect(first.token).toBe('first-token');
    expect(first.tokenHash).toBe(hashCalendarFeedToken('first-token'));
    expect(first.tokenHash).not.toBe(first.token);
  });

  it('regenerates a feed and disables the previous token', async () => {
    const memory = createMemoryStore();
    const first = await ensureCalendarFeedForUser(
      'user-1',
      memory.store,
      () => 'first-token',
    );
    const second = await regenerateCalendarFeedForUser(
      'user-1',
      memory.store,
      () => 'second-token',
    );

    await expect(
      getActiveCalendarFeedByToken('first-token', memory.store),
    ).resolves.toBeNull();
    await expect(
      getActiveCalendarFeedByToken('second-token', memory.store),
    ).resolves.toBe(second);
    expect(first.revokedAt).toBeTruthy();
    expect(second.revokedAt).toBeUndefined();
  });
});
