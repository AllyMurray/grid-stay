import { describe, expect, it, vi } from 'vite-plus/test';
import type { MemberProfileRecord } from '../entities/member-profile.server';
import { type MemberProfilePersistence, setMemberDisplayName } from './member-profile.server';

vi.mock('../entities/member-profile.server', () => ({
  MemberProfileEntity: {},
}));

function createStore(existing: MemberProfileRecord | null = null): MemberProfilePersistence {
  return {
    create: vi.fn(async (item) => item),
    update: vi.fn(async (_userId, changes) => ({
      ...(existing as MemberProfileRecord),
      ...changes,
    })),
    delete: vi.fn(async () => undefined),
    getByUser: vi.fn(async () => existing),
    listAll: vi.fn(async () => []),
  };
}

describe('setMemberDisplayName', () => {
  it('creates a sanitized display-name override', async () => {
    const store = createStore();

    await setMemberDisplayName(
      {
        userId: 'user-1',
        displayName: '  Adam   Mann  ',
        updatedByUserId: 'admin-1',
      },
      store,
    );

    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        profileScope: 'profile',
        displayName: 'Adam Mann',
        updatedByUserId: 'admin-1',
      }),
    );
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('updates an existing display-name override', async () => {
    const store = createStore({
      userId: 'user-1',
      profileScope: 'profile',
      displayName: 'Old Name',
      updatedByUserId: 'admin-1',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as MemberProfileRecord);

    await setMemberDisplayName(
      {
        userId: 'user-1',
        displayName: 'Adam Mann',
        updatedByUserId: 'admin-2',
      },
      store,
    );

    expect(store.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        displayName: 'Adam Mann',
        updatedByUserId: 'admin-2',
      }),
    );
  });

  it('deletes the override when the display name is blank', async () => {
    const store = createStore();

    await setMemberDisplayName(
      {
        userId: 'user-1',
        displayName: '   ',
        updatedByUserId: 'admin-1',
      },
      store,
    );

    expect(store.delete).toHaveBeenCalledWith('user-1');
    expect(store.create).not.toHaveBeenCalled();
  });
});
