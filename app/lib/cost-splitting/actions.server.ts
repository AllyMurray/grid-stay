import type { User } from '~/lib/auth/schemas';
import {
  createCostExpense,
  createCostGroup,
  deleteCostExpense,
  deleteCostGroup,
  updateCostExpense,
  updateCostGroup,
  updateCostSettlementStatus,
} from '~/lib/db/services/cost-splitting.server';
import { setMemberPaymentPreference } from '~/lib/db/services/member-payment-preference.server';
import {
  CostExpenseDeleteSchema,
  CostExpenseUpdateSchema,
  CostExpenseUpsertSchema,
  CostGroupDeleteSchema,
  CostGroupUpdateSchema,
  CostGroupUpsertSchema,
  CostSettlementStatusSchema,
  MemberPaymentPreferenceSchema,
} from '~/lib/schemas/cost-splitting';

type FieldErrors = Partial<Record<string, string[] | undefined>>;

export type CostSplittingActionResult =
  | { ok: true }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors;
    };

export type MemberPaymentPreferenceActionResult = CostSplittingActionResult;

function parseAmountPence(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^£/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [pounds, pennies = ''] = normalized.split('.');
  return Number(pounds) * 100 + Number(pennies.padEnd(2, '0'));
}

async function responseMessage(error: unknown, fallback: string) {
  if (error instanceof Response) {
    return (await error.text()) || fallback;
  }

  return fallback;
}

function costGroupPayload(formData: FormData) {
  return {
    ...Object.fromEntries(formData),
    participantUserIds: formData.getAll('participantUserId').map((value) => value.toString()),
  };
}

function costExpensePayload(formData: FormData) {
  return {
    ...Object.fromEntries(formData),
    amountPence: parseAmountPence(formData.get('amount')),
    currency: 'GBP',
  };
}

export async function submitCreateCostGroup(
  formData: FormData,
  user: User,
): Promise<CostSplittingActionResult> {
  const parsed = CostGroupUpsertSchema.safeParse(costGroupPayload(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not create this cost group yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createCostGroup(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await responseMessage(error, 'Could not create this cost group yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitUpdateCostGroup(
  formData: FormData,
  user: User,
): Promise<CostSplittingActionResult> {
  const parsed = CostGroupUpdateSchema.safeParse(costGroupPayload(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not update this cost group yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateCostGroup(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await responseMessage(error, 'Could not update this cost group yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitDeleteCostGroup(
  formData: FormData,
  user: User,
): Promise<CostSplittingActionResult> {
  const parsed = CostGroupDeleteSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not delete this cost group yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await deleteCostGroup(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await responseMessage(error, 'Could not delete this cost group yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitCreateCostExpense(
  formData: FormData,
  user: User,
): Promise<CostSplittingActionResult> {
  const parsed = CostExpenseUpsertSchema.safeParse(costExpensePayload(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not add this expense yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createCostExpense(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await responseMessage(error, 'Could not add this expense yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitUpdateCostExpense(
  formData: FormData,
  user: User,
): Promise<CostSplittingActionResult> {
  const parsed = CostExpenseUpdateSchema.safeParse(costExpensePayload(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not update this expense yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateCostExpense(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await responseMessage(error, 'Could not update this expense yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitDeleteCostExpense(
  formData: FormData,
  user: User,
): Promise<CostSplittingActionResult> {
  const parsed = CostExpenseDeleteSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not delete this expense yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await deleteCostExpense(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await responseMessage(error, 'Could not delete this expense yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitUpdateCostSettlement(
  formData: FormData,
  user: User,
): Promise<CostSplittingActionResult> {
  const parsed = CostSettlementStatusSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not update this settlement yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateCostSettlementStatus(parsed.data, user);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError: await responseMessage(error, 'Could not update this settlement yet.'),
      fieldErrors: {},
    };
  }
}

export async function submitMemberPaymentPreference(
  formData: FormData,
  user: User,
): Promise<MemberPaymentPreferenceActionResult> {
  const parsed = MemberPaymentPreferenceSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this payment link yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await setMemberPaymentPreference({
    userId: user.id,
    label: parsed.data.label,
    url: parsed.data.url,
  });
  return { ok: true };
}
