import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('~/lib/db/entities/calendar-feed.server', () => ({
  CalendarFeedEntity: {},
}));

import type { CalendarFeedRecord } from '~/lib/db/entities/calendar-feed.server';
import {
  type CalendarFeedPersistence,
  ensureCalendarFeedForUser,
  getActiveCalendarFeedByToken,
  getCalendarFeedOptions,
  hashCalendarFeedToken,
  parseCalendarFeedOptionsFromFormData,
  regenerateCalendarFeedForUser,
  saveCalendarFeedOptionsForUser,
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
    const first = await ensureCalendarFeedForUser('user-1', memory.store, () => 'first-token');
    const second = await ensureCalendarFeedForUser('user-1', memory.store, () => 'second-token');

    expect(second.tokenHash).toBe(first.tokenHash);
    expect(second.token).toBeUndefined();
    expect(memory.items).toHaveLength(1);
    expect(first.token).toBe('first-token');
    expect(memory.items[0]?.token).toBeUndefined();
    expect(memory.items[0]?.tokenHint).toBe('st-token');
    expect(first.tokenHash).toBe(hashCalendarFeedToken('first-token'));
    expect(first.tokenHash).not.toBe(first.token);
    expect(getCalendarFeedOptions(first)).toEqual({
      includeMaybe: true,
      includeStay: true,
    });
  });

  it('regenerates a feed and disables the previous token', async () => {
    const memory = createMemoryStore();
    await ensureCalendarFeedForUser('user-1', memory.store, () => 'first-token');
    const second = await regenerateCalendarFeedForUser(
      'user-1',
      memory.store,
      () => 'second-token',
    );

    await expect(getActiveCalendarFeedByToken('first-token', memory.store)).resolves.toBeNull();
    const activeSecond = await getActiveCalendarFeedByToken('second-token', memory.store);
    expect(activeSecond?.tokenHash).toBe(second.tokenHash);
    expect(activeSecond?.token).toBeUndefined();
    expect(memory.items[0]?.revokedAt).toBeTruthy();
    expect(second.revokedAt).toBeUndefined();
  });

  it('updates feed options without changing the active token', async () => {
    const memory = createMemoryStore();
    const feed = await ensureCalendarFeedForUser('user-1', memory.store, () => 'first-token');

    const updated = await saveCalendarFeedOptionsForUser(
      'user-1',
      {
        includeMaybe: false,
        includeStay: false,
      },
      memory.store,
      () => 'unused-token',
    );

    expect(updated.tokenHash).toBe(feed.tokenHash);
    expect(updated.token).toBeUndefined();
    expect(memory.items[0]?.token).toBeUndefined();
    expect(getCalendarFeedOptions(updated)).toEqual({
      includeMaybe: false,
      includeStay: false,
    });
    expect(memory.items).toHaveLength(1);
  });

  it('parses calendar feed options from form values', () => {
    const formData = new FormData();
    formData.set('includeMaybe', 'false');
    formData.set('includeStay', 'true');

    expect(parseCalendarFeedOptionsFromFormData(formData)).toEqual({
      includeMaybe: false,
      includeStay: true,
    });
  });
});
