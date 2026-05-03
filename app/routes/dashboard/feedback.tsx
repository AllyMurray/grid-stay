import { useActionData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import {
  type FeedbackActionResult,
  submitFeedbackAction,
} from '~/lib/db/services/feedback.server';
import { FeedbackPage } from '~/pages/dashboard/feedback';
import type { Route } from './+types/feedback';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  return Response.json({}, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const result = await submitFeedbackAction(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: 'feedback.submitted',
      message: 'Member feedback submitted.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'feedback',
        id: result.feedback.feedbackId,
      },
      metadata: {
        feedbackType: result.feedback.type,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function FeedbackRoute() {
  const actionData = useActionData<typeof action>() as
    | FeedbackActionResult
    | undefined;

  return <FeedbackPage actionData={actionData} />;
}
