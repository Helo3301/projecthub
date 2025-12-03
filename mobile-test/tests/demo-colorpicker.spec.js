const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Color Picker Demo', () => {
  test('demonstrate color picker in Task Modal', async ({ page }) => {
    // Slow down so you can see it
    test.slow();

    await login(page);

    // Go to Kanban board
    await page.locator('aside').getByText('Kanban').click();
    await expect(page).toHaveURL(/\/kanban/);
    await page.waitForTimeout(1000);

    // Click Add Task button
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    await page.waitForTimeout(500);

    // Modal should be visible with role="dialog"
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    console.log('✓ Task Modal opened with role="dialog"');

    // Fill in a title
    await page.getByTestId('task-title-input').fill('Demo Task with Custom Color');
    await page.waitForTimeout(500);

    // Scroll down to see color picker
    await dialog.evaluate(el => el.scrollTop = 400);
    await page.waitForTimeout(500);

    // Click on color buttons using title attribute
    const colorTitles = ['#EF4444', '#22C55E', '#3B82F6', '#A855F7'];
    for (const title of colorTitles) {
      const colorBtn = page.locator(`button[title="${title}"]`);
      if (await colorBtn.count() > 0) {
        await colorBtn.click();
        console.log(`✓ Selected color: ${title}`);
        await page.waitForTimeout(400);
      }
    }

    // Click the custom color picker (palette icon button)
    const customColorBtn = page.locator('button[title="Custom color"]');
    if (await customColorBtn.count() > 0) {
      await customColorBtn.click();
      console.log('✓ Opened custom color picker');
      await page.waitForTimeout(2000);
    }

    // Close the modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('Demo complete! You saw the color picker in action.');
  });

  test('demonstrate Project Modal color picker', async ({ page }) => {
    test.slow();

    await login(page);
    await page.waitForTimeout(1000);

    // Click New Project in sidebar
    await page.locator('aside').getByText('New Project').click();
    await page.waitForTimeout(500);

    // Modal should appear with dialog role
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    console.log('✓ Project Modal opened with role="dialog"');

    // Fill project name
    await dialog.locator('input[type="text"]').first().fill('Demo Project');
    await page.waitForTimeout(500);

    // Click through color buttons using title attribute
    const colorTitles = ['#F97316', '#14B8A6', '#6366F1', '#EC4899'];
    for (const title of colorTitles) {
      const colorBtn = page.locator(`button[title="${title}"]`);
      if (await colorBtn.count() > 0) {
        await colorBtn.click();
        console.log(`✓ Selected color: ${title}`);
        await page.waitForTimeout(400);
      }
    }

    // Click custom color button
    const customColorBtn = page.locator('button[title="Custom color"]');
    if (await customColorBtn.count() > 0) {
      await customColorBtn.click();
      console.log('✓ Opened custom color picker');
      await page.waitForTimeout(2000);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('Project modal demo complete!');
  });
});
