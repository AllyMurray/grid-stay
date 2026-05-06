import { createHash } from 'node:crypto';
import type { AvailableDayType } from './types';

const DAY_ID_VERSION = 'v2';

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, '-');
}

function hashSegment(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export interface DayIdentityInput {
  type: AvailableDayType;
  sourceName: string;
  date: string;
  stableKey?: string;
  fallbackKey: string;
  variantKey?: string;
}

export function createDayIdentity(input: DayIdentityInput): string {
  const stableSegment = input.stableKey
    ? `stable-${hashSegment(input.stableKey)}`
    : `dated-${sanitizeSegment(input.date)}-${hashSegment(input.fallbackKey)}`;
  const variantSegment = input.variantKey ? `variant-${hashSegment(input.variantKey)}` : 'base';
  return `${input.type}:${input.sourceName}:${DAY_ID_VERSION}:${stableSegment}:${variantSegment}`;
}
