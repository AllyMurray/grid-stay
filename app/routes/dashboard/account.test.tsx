import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { EVENT_BRIEFING_FEATURE } from '~/lib/beta-features/config';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { getPasswordAccountStatus } = vi.hoisted(() => ({
  getPasswordAccountStatus: vi.fn(),
}));
const { getMemberPaymentPreference } = vi.hoisted(() => ({
  getMemberPaymentPreference: vi.fn(),
}));
const { getMemberBetaFeatureSettings, submitMemberBetaFeaturePreference } = vi.hoisted(() => ({
  getMemberBetaFeatureSettings: vi.fn(),
  submitMemberBetaFeaturePreference: vi.fn(),
}));
const { submitMemberPaymentPreference } = vi.hoisted(() => ({
  submitMemberPaymentPreference: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/auth/password-auth.server', () => ({
  getPasswordAccountStatus,
}));

vi.mock('~/lib/db/services/member-payment-preference.server', () => ({
  getMemberPaymentPreference,
}));

vi.mock('~/lib/beta-features/preferences.server', () => ({
  getMemberBetaFeatureSettings,
  submitMemberBetaFeaturePreference,
}));

vi.mock('~/lib/cost-splitting/actions.server', () => ({
  submitMemberPaymentPreference,
}));

import { action, loader } from './account';

const user = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

describe('account route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({
      user,
      headers: new Headers(),
    });
    getPasswordAccountStatus.mockReset();
    getPasswordAccountStatus.mockResolvedValue({
      hasPassword: true,
      headers: new Headers(),
    });
    getMemberPaymentPreference.mockReset();
    getMemberPaymentPreference.mockResolvedValue(null);
    getMemberBetaFeatureSettings.mockReset();
    getMemberBetaFeatureSettings.mockResolvedValue({
      [EVENT_BRIEFING_FEATURE]: false,
    });
    submitMemberBetaFeaturePreference.mockReset();
    submitMemberPaymentPreference.mockReset();
  });

  it('loads account beta feature settings', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/account'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toMatchObject({
      betaFeatures: {
        [EVENT_BRIEFING_FEATURE]: false,
      },
      hasPassword: true,
      paymentPreference: null,
      user,
    });
    expect(getMemberBetaFeatureSettings).toHaveBeenCalledWith('user-1');
  });

  it('routes beta feature updates by intent', async () => {
    const formData = new FormData();
    formData.set('intent', 'updateBetaFeature');
    formData.set('featureKey', EVENT_BRIEFING_FEATURE);
    formData.set('enabled', 'true');
    submitMemberBetaFeaturePreference.mockResolvedValue({
      ok: true,
      betaFeatures: {
        [EVENT_BRIEFING_FEATURE]: true,
      },
      message: 'Beta feature enabled.',
    });

    const response = (await action({
      request: new Request('https://gridstay.app/dashboard/account', {
        method: 'POST',
        body: formData,
      }),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      message: 'Beta feature enabled.',
    });
    const submittedFormData = submitMemberBetaFeaturePreference.mock.calls[0]?.[0] as
      | FormData
      | undefined;
    expect(submittedFormData?.get('intent')).toBe('updateBetaFeature');
    expect(submittedFormData?.get('featureKey')).toBe(EVENT_BRIEFING_FEATURE);
    expect(submittedFormData?.get('enabled')).toBe('true');
    expect(submitMemberBetaFeaturePreference.mock.calls[0]?.[1]).toEqual(user);
    expect(submitMemberPaymentPreference).not.toHaveBeenCalled();
  });
});
