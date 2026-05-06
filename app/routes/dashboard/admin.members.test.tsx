import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));
const { listMemberJoinLinks, submitMemberJoinLinkAction } = vi.hoisted(() => ({
  listMemberJoinLinks: vi.fn(),
  submitMemberJoinLinkAction: vi.fn(),
}));
const { listAdminSiteMembers } = vi.hoisted(() => ({
  listAdminSiteMembers: vi.fn(),
}));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireAdmin,
}));

vi.mock('~/lib/auth/member-join-links.server', () => ({
  listMemberJoinLinks,
  submitMemberJoinLinkAction,
}));

vi.mock('~/lib/auth/members.server', () => ({
  listAdminSiteMembers,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { action, loader } from './admin.members';

const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin One',
  role: 'admin' as const,
};
const joinLink = {
  tokenHash: 'hash-1',
  tokenHint: 'ABCDEFGH',
  mode: 'reusable' as const,
  acceptedCount: 0,
  state: 'active' as const,
  createdByName: 'Admin One',
  expiresAt: '2026-05-05T10:00:00.000Z',
  createdAt: '2026-05-04T10:00:00.000Z',
};

describe('admin members route', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue({ user: admin, headers: new Headers() });
    listAdminSiteMembers.mockReset();
    listAdminSiteMembers.mockResolvedValue([]);
    listMemberJoinLinks.mockReset();
    listMemberJoinLinks.mockResolvedValue([joinLink]);
    submitMemberJoinLinkAction.mockReset();
    submitMemberJoinLinkAction.mockResolvedValue({
      ok: true,
      intent: 'createJoinLink',
      message: 'Join link created.',
      link: joinLink,
      joinUrl: 'https://gridstay.app/join/token',
    });
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('loads members and join links for admins', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/admin/members'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      members: [],
      joinLinks: [joinLink],
    });
  });

  it('handles join-link actions and records audit events', async () => {
    const formData = new FormData();
    formData.set('intent', 'createJoinLink');
    formData.set('mode', 'reusable');
    const request = new Request('https://gridstay.app/dashboard/admin/members', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(submitMemberJoinLinkAction).toHaveBeenCalledOnce();
    const [submittedInput] = submitMemberJoinLinkAction.mock.calls[0]!;
    expect(submittedInput.formData.get('intent')).toBe('createJoinLink');
    expect(submittedInput.user).toBe(admin);
    expect(submittedInput.request).toBe(request);
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'memberJoinLink.createJoinLink',
        subject: { type: 'memberJoinLink', id: 'hash-1' },
      }),
    );
  });
});
