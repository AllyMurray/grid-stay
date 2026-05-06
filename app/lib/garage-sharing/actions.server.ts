import type { User } from '~/lib/auth/schemas';
import {
  createGarageShareRequest,
  updateGarageShareRequestStatus,
} from '~/lib/db/services/garage-sharing.server';
import type { GarageShareDecisionInput, GarageShareRequestInput } from '~/lib/schemas/garage-share';
import { GarageShareDecisionSchema, GarageShareRequestSchema } from '~/lib/schemas/garage-share';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export type GarageShareRequestActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof GarageShareRequestInput>;
    };

export type GarageShareDecisionActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof GarageShareDecisionInput>;
    };

async function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Response) {
    return (await error.text()) || error.statusText || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export async function submitGarageShareRequest(
  formData: FormData,
  user: User,
  saveRequest: typeof createGarageShareRequest = createGarageShareRequest,
): Promise<GarageShareRequestActionResult> {
  const parsed = GarageShareRequestSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not send this garage request yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await saveRequest(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await getErrorMessage(error, 'Could not send this garage request yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitGarageShareDecision(
  formData: FormData,
  user: User,
  saveDecision: typeof updateGarageShareRequestStatus = updateGarageShareRequestStatus,
): Promise<GarageShareDecisionActionResult> {
  const parsed = GarageShareDecisionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not update this garage request yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await saveDecision(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await getErrorMessage(error, 'Could not update this garage request yet.'),
      fieldErrors: {},
    };
  }
}
