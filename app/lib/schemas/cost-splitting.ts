import { z } from 'zod';

export const CostGroupCategorySchema = z.enum([
  'track_day',
  'hotel',
  'garage',
  'food',
  'fuel',
  'other',
]);

export const CostCurrencySchema = z.literal('GBP');

export const CostGroupUpsertSchema = z.object({
  dayId: z.string().trim().min(1),
  groupId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  category: CostGroupCategorySchema,
  participantUserIds: z.array(z.string().trim().min(1)).min(1),
});

export const CostGroupUpdateSchema = CostGroupUpsertSchema.extend({
  groupId: z.string().trim().min(1),
});

export const CostGroupDeleteSchema = z.object({
  dayId: z.string().trim().min(1),
  groupId: z.string().trim().min(1),
});

export const CostExpenseUpsertSchema = z.object({
  dayId: z.string().trim().min(1),
  groupId: z.string().trim().min(1),
  expenseId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(120),
  amountPence: z.number().int().positive().max(5_000_000),
  currency: CostCurrencySchema.default('GBP'),
  paidByUserId: z.string().trim().min(1),
  notes: z.string().trim().max(500).optional().default(''),
});

export const CostExpenseUpdateSchema = CostExpenseUpsertSchema.extend({
  expenseId: z.string().trim().min(1),
});

export const CostExpenseDeleteSchema = z.object({
  dayId: z.string().trim().min(1),
  groupId: z.string().trim().min(1),
  expenseId: z.string().trim().min(1),
});

export const CostSettlementStatusSchema = z.object({
  dayId: z.string().trim().min(1),
  debtorUserId: z.string().trim().min(1),
  creditorUserId: z.string().trim().min(1),
  amountPence: z.coerce.number().int().positive(),
  currency: CostCurrencySchema,
  breakdownHash: z.string().trim().min(1),
  status: z.enum(['sent', 'received']),
});

export const MemberPaymentPreferenceSchema = z
  .object({
    label: z.string().trim().max(40).optional().default(''),
    url: z.string().trim().max(300).optional().default(''),
  })
  .superRefine((value, context) => {
    const hasLabel = Boolean(value.label);
    const hasUrl = Boolean(value.url);

    if (hasLabel !== hasUrl) {
      context.addIssue({
        code: 'custom',
        path: hasLabel ? ['url'] : ['label'],
        message: 'Enter both a label and a payment link, or clear both.',
      });
      return;
    }

    if (!value.url) {
      return;
    }

    try {
      const url = new URL(value.url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Enter a valid http or https payment link.',
      });
    }
  });

export type CostGroupCategory = z.infer<typeof CostGroupCategorySchema>;
export type CostGroupUpsertInput = z.infer<typeof CostGroupUpsertSchema>;
export type CostGroupUpdateInput = z.infer<typeof CostGroupUpdateSchema>;
export type CostGroupDeleteInput = z.infer<typeof CostGroupDeleteSchema>;
export type CostExpenseUpsertInput = z.infer<typeof CostExpenseUpsertSchema>;
export type CostExpenseUpdateInput = z.infer<typeof CostExpenseUpdateSchema>;
export type CostExpenseDeleteInput = z.infer<typeof CostExpenseDeleteSchema>;
export type CostSettlementStatusInput = z.infer<typeof CostSettlementStatusSchema>;
export type MemberPaymentPreferenceInput = z.infer<typeof MemberPaymentPreferenceSchema>;
