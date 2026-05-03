import { describe, expect, it, vi } from 'vitest';
import type { WhatsNewEntry } from '~/lib/whats-new';
import type { WhatsNewViewRecord } from '../entities/whats-new-view.server';
import {
  countNewWhatsNewEntries,
  markWhatsNewViewed,
} from './whats-new-view.server';

vi.mock('../entities/whats-new-view.server', () => ({
  WhatsNewViewEntity: {},
}));

const entries = [
  {
    id: 'first',
    title: 'First update',
    publishedAt: '2026-05-01T10:00:00.000Z',
  },
  {
    id: 'second',
    title: 'Second update',
    publishedAt: '2026-05-02T10:00:00.000Z',
  },
  {
    id: 'third',
    title: 'Third update',
    publishedAt: '2026-05-03T10:00:00.000Z',
  },
] as WhatsNewEntry[];

function createMemoryStore(initial?: WhatsNewViewRecord) {
  let record = initial ?? null;

  return {
    async put(item: WhatsNewViewRecord) {
      record = item;
      return item;
    },
    async getByUser(userId: string) {
      return record?.userId === userId ? record : null;
    },
    async listAll() {
      return record ? [record] : [];
    },
  };
}

describe('whats new view service', () => {
  it('counts every entry when the user has not visited whats new yet', async () => {
    const store = createMemoryStore();

    await expect(
      countNewWhatsNewEntries('user-1', { store, entries }),
    ).resolves.toBe(3);
  });

  it('counts only entries published after the last visit', async () => {
    const store = createMemoryStore({
      userId: 'user-1',
      viewScope: 'whats-new',
      lastViewedAt: '2026-05-02T10:00:00.000Z',
      createdAt: '2026-05-02T10:00:00.000Z',
      updatedAt: '2026-05-02T10:00:00.000Z',
    } as WhatsNewViewRecord);

    await expect(
      countNewWhatsNewEntries('user-1', { store, entries }),
    ).resolves.toBe(1);
  });

  it('stores the latest visit time without changing the original create time', async () => {
    const store = createMemoryStore({
      userId: 'user-1',
      viewScope: 'whats-new',
      lastViewedAt: '2026-05-01T10:00:00.000Z',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } as WhatsNewViewRecord);
    const put = vi.spyOn(store, 'put');

    await markWhatsNewViewed('user-1', { store }, '2026-05-03T12:00:00.000Z');

    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        viewScope: 'whats-new',
        lastViewedAt: '2026-05-03T12:00:00.000Z',
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-03T12:00:00.000Z',
      }),
    );
  });
});
