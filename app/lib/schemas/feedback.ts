import { z } from 'zod';

export const FeedbackTypeSchema = z.enum([
  'feature_request',
  'feedback',
  'bug_report',
]);

export const SubmitFeedbackSchema = z.object({
  type: FeedbackTypeSchema,
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  context: z.string().trim().max(240).optional().default(''),
});

export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackSchema>;
