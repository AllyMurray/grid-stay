import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { listRecentFeedback, submitAdminFeedbackAction } from '~/lib/db/services/feedback.server';
import { sendFeedbackUpdateEmail } from '~/lib/email/feedback-update.server';
import { AdminFeedbackPage, type AdminFeedbackPageProps } from '~/pages/dashboard/admin-feedback';
import type { Route } from './+types/admin.feedback';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const feedback = await listRecentFeedback();

  return Response.json(
    {
      feedback,
    } satisfies AdminFeedbackPageProps,
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  let result = await submitAdminFeedbackAction(formData, user);

  if (result.ok && result.intent === 'sendUpdate') {
    try {
      await sendFeedbackUpdateEmail({
        request,
        feedback: result.feedback,
        update: result.update,
      });
      result = {
        ...result,
        message: 'Feedback update saved and emailed.',
      };
    } catch (error) {
      result = {
        ...result,
        warning: 'The update was saved, but the member email could not be sent.',
      };

      await recordAppEventSafely({
        category: 'error',
        action: 'feedback.update.email.failed',
        message: 'Feedback update email failed.',
        actor: { userId: user.id, name: user.name },
        subject: {
          type: 'feedback',
          id: result.feedback.feedbackId,
        },
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (result.ok) {
    const subjectId =
      result.intent === 'deleteFeedback' ? result.feedbackId : result.feedback.feedbackId;

    await recordAppEventSafely({
      category: 'audit',
      action:
        result.intent === 'saveStatus'
          ? 'feedback.status.updated'
          : result.intent === 'sendUpdate'
            ? 'feedback.update.saved'
            : 'feedback.deleted',
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'feedback',
        id: subjectId,
      },
      metadata:
        result.intent === 'deleteFeedback'
          ? undefined
          : {
              status: result.feedback.status,
              ...(result.intent === 'sendUpdate'
                ? {
                    updateId: result.update.updateId,
                    emailWarning: Boolean(result.warning),
                  }
                : {}),
            },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminFeedbackRoute() {
  const data = useLoaderData<typeof loader>() as AdminFeedbackPageProps;
  return <AdminFeedbackPage {...data} />;
}
