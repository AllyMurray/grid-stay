import {
  BackgroundImage,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconCalendarEvent,
  IconHotelService,
  IconUsersGroup,
} from '@tabler/icons-react';
import { Link } from 'react-router';

const HERO_IMAGE =
  'https://images.pexels.com/photos/1571882/pexels-photo-1571882.jpeg?cs=srgb&dl=pexels-tomverdoot-1571882.jpg&fm=jpg';
const SUPPORT_IMAGE =
  'https://images.pexels.com/photos/29255722/pexels-photo-29255722.jpeg?cs=srgb&dl=pexels-jonathanborba-29255722.jpg&fm=jpg';

interface HomePageProps {
  hasSession: boolean;
}

export function HomePage({ hasSession }: HomePageProps) {
  const cta = hasSession ? '/dashboard' : '/auth/login';

  return (
    <Box>
      <BackgroundImage src={HERO_IMAGE} className="home-hero">
        <Container size="xl" className="home-hero-content">
          <Stack h="100%" justify="space-between" py={{ base: 'md', sm: 'xl' }}>
            <Group justify="space-between" align="center">
              <Stack gap={0}>
                <Text fw={800} ff="Oswald, sans-serif" size="xl" c="white">
                  Grid Stay
                </Text>
                <Text size="sm" c="gray.1">
                  Motorsport weekends without the group-text mess
                </Text>
              </Stack>
              <Button
                component={Link}
                to={cta}
                variant="white"
                color="dark"
                radius="sm"
              >
                {hasSession ? 'Open dashboard' : 'Sign in with Google'}
              </Button>
            </Group>

            <Stack gap="lg" maw={720} pb={{ base: 40, sm: 56 }}>
              <Badge variant="white" color="dark" w="fit-content">
                Built for race weekends
              </Badge>
              <Title order={1} c="white" fz={{ base: 46, sm: 64 }}>
                Keep the whole paddock on one plan.
              </Title>
              <Text size="lg" c="gray.1" maw={620}>
                Track every race day, test day, and track day, then keep the
                crew aligned on who is going and where the stay is booked.
              </Text>
              <Group>
                <Button component={Link} to={cta} size="lg" color="brand">
                  {hasSession ? 'Go to overview' : 'Start with Google'}
                </Button>
                <Button
                  component="a"
                  href="#product"
                  size="lg"
                  variant="white"
                  color="dark"
                >
                  See the flow
                </Button>
              </Group>
            </Stack>
          </Stack>
        </Container>
      </BackgroundImage>

      <Box component="section" id="product" py={56}>
        <Container size="xl">
          <Grid gutter="xl" align="center">
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Stack gap="lg">
                <Badge color="brand" variant="light" w="fit-content">
                  One trip thread
                </Badge>
                <Title order={2} maw={480}>
                  Leave the date chasing, booking screenshots, and hotel
                  guesswork behind.
                </Title>
                <Text c="dimmed" maw={520}>
                  Grid Stay keeps the calendar, attendance, and shared stay
                  details together so the group can make decisions early and
                  arrive in the same place.
                </Text>
                <Stack gap="md">
                  {[
                    {
                      icon: IconCalendarEvent,
                      title: 'One schedule',
                      text: 'Race, test, and track dates stay in one running feed.',
                    },
                    {
                      icon: IconUsersGroup,
                      title: 'Clear attendance',
                      text: 'Everyone can see who is locked in and who is still deciding.',
                    },
                    {
                      icon: IconHotelService,
                      title: 'Private references',
                      text: 'Booking numbers and private notes stay with the driver who entered them.',
                    },
                  ].map((item) => (
                    <Group key={item.title} align="flex-start" wrap="nowrap">
                      <ThemeIcon
                        size={38}
                        radius="sm"
                        variant="light"
                        color="brand"
                      >
                        <item.icon size={18} />
                      </ThemeIcon>
                      <Stack gap={2}>
                        <Text fw={700}>{item.title}</Text>
                        <Text size="sm" c="dimmed">
                          {item.text}
                        </Text>
                      </Stack>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Image
                src={SUPPORT_IMAGE}
                alt="Busy pit lane before the race weekend begins"
                radius="sm"
                className="feature-image"
              />
            </Grid.Col>
          </Grid>

          <Grid mt="xl">
            {[
              {
                title: 'Before the weekend',
                text: 'Know what dates are live and get the stay sorted while the options are still good.',
              },
              {
                title: 'During planning',
                text: 'See who is booked, who is maybe, and which accommodation the group is converging on.',
              },
              {
                title: 'After sign-in',
                text: 'Move straight into the trip workspace instead of bouncing between group chat and spreadsheets.',
              },
            ].map((item) => (
              <Grid.Col key={item.title} span={{ base: 12, md: 4 }}>
                <Paper className="shell-card" p="lg">
                  <Stack gap="sm">
                    <Title order={3}>{item.title}</Title>
                    <Text c="dimmed">{item.text}</Text>
                  </Stack>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
