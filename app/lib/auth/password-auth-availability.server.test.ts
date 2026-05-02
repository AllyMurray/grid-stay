import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPasswordAuthEnabled } from './password-auth-availability.server';

describe('password auth availability', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when the flag is missing', () => {
    expect(isPasswordAuthEnabled()).toBe(false);
  });

  it('accepts explicit truthy values', () => {
    vi.stubEnv('GRID_STAY_PASSWORD_AUTH_ENABLED', 'true');
    expect(isPasswordAuthEnabled()).toBe(true);

    vi.stubEnv('GRID_STAY_PASSWORD_AUTH_ENABLED', '1');
    expect(isPasswordAuthEnabled()).toBe(true);
  });
});
