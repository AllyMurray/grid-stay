import { expect, test } from '@playwright/test';

test('dashboard mobile menu opens visibly and navigates from a real browser', async ({
  page,
}) => {
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await expect(menuButton).toBeVisible();

  const membersLink = page.getByRole('link', { name: 'Members' });
  await expect(membersLink).not.toBeInViewport();

  await menuButton.click();

  await expect(
    page.getByRole('button', { name: 'Close menu' }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(membersLink).toBeVisible();
  await expect(membersLink).toBeInViewport();

  await membersLink.click();

  await expect(page.getByText('Members page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
