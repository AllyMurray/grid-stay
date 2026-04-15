import type { User } from '~/lib/auth/schemas';
import { createBooking, updateBooking } from '~/lib/db/services/booking.server';
import type {
  CreateBookingInput,
  UpdateBookingInput,
} from '~/lib/schemas/booking';
import {
  CreateBookingSchema,
  UpdateBookingSchema,
} from '~/lib/schemas/booking';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export type CreateBookingActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof CreateBookingInput>;
    };

export type UpdateBookingActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof UpdateBookingInput>;
    };

export async function submitCreateBooking(
  formData: FormData,
  user: User,
  saveBooking: typeof createBooking = createBooking,
): Promise<CreateBookingActionResult> {
  const parsed = CreateBookingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'This day could not be added right now.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await saveBooking(parsed.data, user);
  return { ok: true };
}

export async function submitBookingUpdate(
  formData: FormData,
  userId: string,
  saveBooking: typeof updateBooking = updateBooking,
): Promise<UpdateBookingActionResult> {
  const parsed = UpdateBookingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this booking yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await saveBooking(userId, parsed.data);
  return { ok: true };
}
