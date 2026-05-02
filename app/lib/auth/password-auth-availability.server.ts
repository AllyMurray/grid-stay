const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isPasswordAuthEnabled(): boolean {
  const value = process.env.GRID_STAY_PASSWORD_AUTH_ENABLED;

  return value ? TRUTHY_VALUES.has(value.trim().toLowerCase()) : false;
}
