import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBuildingSkyscraper,
  IconSparkles,
  IconStar,
} from '@tabler/icons-react';
import { Link, useFetcher } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';
import type { HotelReviewActionResult } from '~/lib/bookings/actions.server';
import type { HotelInsight } from '~/lib/db/services/hotel.server';

export interface HotelFeedbackPageProps {
  insight: HotelInsight;
  currentUserId: string;
  returnTo: string;
}

function getRatingLabel(value?: number) {
  return value ? `${value}/5` : 'No rating yet';
}

export function HotelFeedbackPage({ insight, currentUserId, returnTo }: HotelFeedbackPageProps) {
  const fetcher = useFetcher<HotelReviewActionResult>();
  const isSaving = fetcher.state !== 'idle';
  const formError = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const fieldErrors = fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const saved = fetcher.state === 'idle' && fetcher.data?.ok === true;
  const myReview = insight.reviews.find((review) => review.userId === currentUserId);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Hotel feedback"
        title={insight.hotel.name}
        description="Capture the parking, check-in, and arrival details that help the group choose where to stay."
        actions={
          <Button component={Link} to={returnTo} variant="default">
            Back to booking
          </Button>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" gap="md">
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={38} radius="sm" color="blue" variant="light">
                <IconBuildingSkyscraper size={22} />
              </ThemeIcon>
              <Stack gap={4}>
                <Title order={2}>{insight.hotel.name}</Title>
                {insight.hotel.address ? (
                  <Text size="sm" c="dimmed">
                    {insight.hotel.address}
                  </Text>
                ) : null}
                <Text size="sm">{insight.summary}</Text>
                <Group gap="xs" wrap="wrap">
                  <Badge size="xs" variant="light" color="blue">
                    {insight.summarySource === 'bedrock' ? 'AI summary' : 'Review summary'}
                  </Badge>
                  <Badge size="xs" variant="light" color="gray">
                    {insight.reviewCount} {insight.reviewCount === 1 ? 'review' : 'reviews'}
                  </Badge>
                </Group>
              </Stack>
            </Group>
            <Stack gap={2} align="flex-end">
              <Group gap={4}>
                <IconStar size={16} />
                <Text fw={700}>{getRatingLabel(insight.averageRating)}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Group rating
              </Text>
            </Stack>
          </Group>

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="saveHotelReview" />
            <input type="hidden" name="hotelId" value={insight.hotel.hotelId} />
            <Stack gap="md">
              <Group gap="xs" align="center">
                <ThemeIcon size={28} radius="sm" variant="light" color="blue">
                  <IconSparkles size={16} />
                </ThemeIcon>
                <Text fw={700}>Your feedback</Text>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <NumberInput
                  name="rating"
                  label="Overall rating"
                  description="Optional group usefulness rating."
                  min={1}
                  max={5}
                  defaultValue={myReview?.rating}
                  error={fieldErrors?.rating?.[0]}
                />
                <Select
                  name="trailerParking"
                  label="Trailer parking"
                  defaultValue={myReview?.trailerParking ?? 'unknown'}
                  data={[
                    { value: 'unknown', label: 'Not sure' },
                    { value: 'good', label: 'Good' },
                    { value: 'limited', label: 'Limited' },
                    { value: 'none', label: 'None' },
                  ]}
                  error={fieldErrors?.trailerParking?.[0]}
                />
                <Select
                  name="secureParking"
                  label="Secure parking"
                  defaultValue={myReview?.secureParking ?? 'unknown'}
                  data={[
                    { value: 'unknown', label: 'Not sure' },
                    { value: 'yes', label: 'Yes' },
                    { value: 'mixed', label: 'Mixed' },
                    { value: 'no', label: 'No' },
                  ]}
                  error={fieldErrors?.secureParking?.[0]}
                />
                <Select
                  name="lateCheckIn"
                  label="Late check-in"
                  defaultValue={myReview?.lateCheckIn ?? 'unknown'}
                  data={[
                    { value: 'unknown', label: 'Not sure' },
                    { value: 'yes', label: 'Yes' },
                    { value: 'limited', label: 'Limited' },
                    { value: 'no', label: 'No' },
                  ]}
                  error={fieldErrors?.lateCheckIn?.[0]}
                />
              </SimpleGrid>

              <Textarea
                name="parkingNotes"
                label="Parking notes"
                description="Trailer room, car park access, lighting, barriers, or anything awkward."
                minRows={2}
                defaultValue={myReview?.parkingNotes ?? ''}
                error={fieldErrors?.parkingNotes?.[0]}
                maxLength={500}
              />
              <Textarea
                name="generalNotes"
                label="General hotel notes"
                description="Food, check-in, noise, distance to circuit, or other group-relevant notes."
                minRows={3}
                defaultValue={myReview?.generalNotes ?? ''}
                error={fieldErrors?.generalNotes?.[0]}
                maxLength={1000}
              />

              {formError ? (
                <Alert color="red" icon={<IconAlertCircle size={18} />}>
                  {formError}
                </Alert>
              ) : null}

              {saved ? (
                <Alert color="green" variant="light">
                  Hotel feedback saved.
                </Alert>
              ) : null}

              <Group justify="flex-end">
                <Button type="submit" loading={isSaving}>
                  Save hotel feedback
                </Button>
              </Group>
            </Stack>
          </fetcher.Form>
        </Stack>
      </Paper>
    </Stack>
  );
}
