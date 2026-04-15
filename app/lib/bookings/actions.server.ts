import type { User } from '~/lib/auth/schemas';
import {
  applySharedStaySelection,
  createBooking,
  updateBooking,
} from '~/lib/db/services/booking.server';
import type {
  CreateBookingInput,
  SharedStaySelectionInput,
  UpdateBookingInput,
} from '~/lib/schemas/booking';
import {
  CreateBookingSchema,
  SharedStaySelectionSchema,
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

export type SharedStaySelectionActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof SharedStaySelectionInput>;
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

export async function submitSharedStaySelection(
  formData: FormData,
  user: User,
  saveSelection: typeof applySharedStaySelection = applySharedStaySelection,
): Promise<SharedStaySelectionActionResult> {
  const parsed = SharedStaySelectionSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this shared stay yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await saveSelection(parsed.data, user);
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
