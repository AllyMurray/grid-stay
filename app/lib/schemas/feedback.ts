import { z } from 'zod';

export const FeedbackTypeSchema = z.enum(['feature_request', 'feedback', 'bug_report']);
export const FeedbackStatusSchema = z.enum(['new', 'reviewed', 'planned', 'closed']);

export const SubmitFeedbackSchema = z.object({
  type: FeedbackTypeSchema,
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  context: z.string().trim().max(240).optional().default(''),
});

const FeedbackIdSchema = z.string().trim().min(1, 'Feedback id is required.');

export const FeedbackAdminUpdateSchema = z.object({
  updateId: z.string().trim().min(1),
  status: FeedbackStatusSchema,
  message: z.string().trim().min(1).max(2000),
  createdAt: z.string().trim().min(1),
  authorUserId: z.string().trim().min(1).optional(),
  authorName: z.string().trim().min(1).optional(),
});

export const FeedbackAdminUpdateListSchema = z.array(FeedbackAdminUpdateSchema);

export const SaveFeedbackStatusSchema = z.object({
  feedbackId: FeedbackIdSchema,
  status: FeedbackStatusSchema,
});

export const SendFeedbackUpdateSchema = SaveFeedbackStatusSchema.extend({
  message: z.string().trim().min(3).max(2000),
});

export const DeleteFeedbackSchema = z.object({
  feedbackId: FeedbackIdSchema,
});

export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackSchema>;
export type FeedbackAdminUpdate = z.infer<typeof FeedbackAdminUpdateSchema>;
export type SaveFeedbackStatusInput = z.infer<typeof SaveFeedbackStatusSchema>;
export type SendFeedbackUpdateInput = z.infer<typeof SendFeedbackUpdateSchema>;
export type DeleteFeedbackInput = z.infer<typeof DeleteFeedbackSchema>;
