import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { listPendingMemberInvitesForUser, submitMemberInviteAction } = vi.hoisted(() => ({
  listPendingMemberInvitesForUser: vi.fn(),
  submitMemberInviteAction: vi.fn(),
}));
const { listSiteMembers } = vi.hoisted(() => ({
  listSiteMembers: vi.fn(),
}));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/auth/member-invites.server', () => ({
  listPendingMemberInvitesForUser,
  submitMemberInviteAction,
}));

vi.mock('~/lib/auth/members.server', () => ({
  listSiteMembers,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { action, loader } from './members';

const user = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member' as const,
};
const invite = {
  inviteEmail: 'new.driver@example.com',
  invitedByName: 'Driver One',
  status: 'pending' as const,
  expiresAt: '2026-05-28T10:00:00.000Z',
  createdAt: '2026-04-28T10:00:00.000Z',
};

describe('members route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({ user, headers: new Headers() });
    listSiteMembers.mockReset();
    listSiteMembers.mockResolvedValue([]);
    listPendingMemberInvitesForUser.mockReset();
    listPendingMemberInvitesForUser.mockResolvedValue([invite]);
    submitMemberInviteAction.mockReset();
    submitMemberInviteAction.mockResolvedValue({
      ok: true,
      message: 'new.driver@example.com can now sign in.',
      invite,
    });
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('loads members with only invites sent by the current user', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/members'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      members: [],
      pendingInvites: [invite],
    });
    expect(listPendingMemberInvitesForUser).toHaveBeenCalledWith('user-1');
  });

  it('submits member invite actions as the current user', async () => {
    const formData = new FormData();
    formData.set('intent', 'createInvite');
    formData.set('email', 'new.driver@example.com');
    const request = new Request('https://gridstay.app/dashboard/members', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(submitMemberInviteAction).toHaveBeenCalledOnce();
    const [submittedFormData, submittedUser] = submitMemberInviteAction.mock.calls[0]!;
    expect(submittedUser).toBe(user);
    expect(submittedFormData.get('intent')).toBe('createInvite');
    expect(submittedFormData.get('email')).toBe('new.driver@example.com');
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'member.invite.createInvite',
        subject: { type: 'memberInvite', id: 'new.driver@example.com' },
      }),
    );
  });
});
