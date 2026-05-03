import {
  Alert,
  Button,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconMessageCircle,
} from '@tabler/icons-react';
import { Form, useNavigation } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';
import type { FeedbackActionResult } from '~/lib/db/services/feedback.server';

export interface FeedbackPageProps {
  actionData?: FeedbackActionResult;
}

const feedbackTypeOptions = [
  { value: 'feature_request', label: 'Feature request' },
  { value: 'feedback', label: 'General feedback' },
  { value: 'bug_report', label: 'Something is not working' },
];

function getFieldValues(actionData: FeedbackActionResult | undefined) {
  return actionData && !actionData.ok ? actionData.values : undefined;
}

function getTypeDefault(value: string | undefined) {
  return feedbackTypeOptions.some((option) => option.value === value)
    ? value
    : 'feature_request';
}

export function FeedbackPage({ actionData }: FeedbackPageProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';
  const values = getFieldValues(actionData);
  const fieldErrors =
    actionData && !actionData.ok ? actionData.fieldErrors : undefined;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Feedback"
        title="Send feedback"
        description="Share an idea, request a feature, or tell us where something is not working."
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Stack gap={2}>
            <ThemeIcon size={42} radius="sm" color="brand" variant="light">
              <IconMessageCircle size={22} />
            </ThemeIcon>
            <Title order={2} fz="h3">
              What should change?
            </Title>
            <Text size="sm" c="dimmed">
              Requests go to the site admins with your account details attached
              so they can follow up if needed.
            </Text>
          </Stack>

          {actionData?.ok ? (
            <Alert color="green" icon={<IconCircleCheck size={18} />}>
              {actionData.message}
            </Alert>
          ) : null}
          {actionData && !actionData.ok ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {actionData.formError}
            </Alert>
          ) : null}

          <Form method="post">
            <Stack gap="md">
              <Select
                name="type"
                label="Request type"
                data={feedbackTypeOptions}
                defaultValue={getTypeDefault(values?.type)}
                error={fieldErrors?.type?.[0]}
                required
              />
              <TextInput
                name="title"
                label="Short title"
                placeholder="Add calendar filtering by championship"
                defaultValue={values?.title ?? ''}
                error={fieldErrors?.title?.[0]}
                required
              />
              <Textarea
                name="message"
                label="Details"
                placeholder="What are you trying to do, and what would make it easier?"
                defaultValue={values?.message ?? ''}
                error={fieldErrors?.message?.[0]}
                minRows={5}
                required
              />
              <TextInput
                name="context"
                label="Relevant page or workflow"
                placeholder="Available Days, Members, My Bookings"
                defaultValue={values?.context ?? ''}
                error={fieldErrors?.context?.[0]}
              />
              <Button
                type="submit"
                leftSection={<IconMessageCircle size={18} />}
                loading={isSubmitting}
                fullWidth
              >
                Send feedback
              </Button>
            </Stack>
          </Form>
        </Stack>
      </Paper>
    </Stack>
  );
}
