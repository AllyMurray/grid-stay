import { expect, test } from '@playwright/test';

test('dashboard mobile menu opens visibly and navigates from a real browser', async ({
  page,
}) => {
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await expect(menuButton).toBeVisible();

  await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);

  await menuButton.click();

  await expect(
    page.locator('button[aria-controls="dashboard-mobile-menu"]'),
  ).toHaveAttribute('aria-expanded', 'true');
  const navigationDrawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(navigationDrawer).toBeVisible();
  const membersLink = navigationDrawer.getByRole('link', { name: 'Members' });
  await expect(membersLink).toBeVisible();
  await expect(membersLink).toBeInViewport();

  await membersLink.click();

  await expect(page.getByText('Members page')).toBeVisible();
  await expect(navigationDrawer).not.toBeVisible();
  await expect(
    page.locator('button[aria-controls="dashboard-mobile-menu"]'),
  ).toHaveAttribute('aria-expanded', 'false');
});
