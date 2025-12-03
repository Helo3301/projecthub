const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.URL || 'http://localhost:3030';
const USERNAME = process.env.USERNAME || 'Helo';
const PASSWORD = process.env.PASSWORD || 'test123';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');

// Device configurations
const DEVICES = [
  { name: 'iPhone-14', device: devices['iPhone 14'] },
  { name: 'iPhone-14-Pro-Max', device: devices['iPhone 14 Pro Max'] },
  { name: 'Pixel-7', device: devices['Pixel 7'] },
  { name: 'iPad-Mini', device: devices['iPad Mini'] },
  { name: 'Desktop-1920', device: { viewport: { width: 1920, height: 1080 } } },
];

// Pages to screenshot
const PAGES = [
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/', requiresAuth: true },
  { name: 'kanban', path: '/kanban', requiresAuth: true },
  { name: 'gantt', path: '/gantt', requiresAuth: true },
  { name: 'calendar', path: '/calendar', requiresAuth: true },
  { name: 'team', path: '/team', requiresAuth: true },
  { name: 'settings', path: '/settings', requiresAuth: true },
];

async function run() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  console.log(`\n📱 Mobile Screenshot Tool`);
  console.log(`   URL: ${BASE_URL}`);
  console.log(`   User: ${USERNAME}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  for (const deviceConfig of DEVICES) {
    console.log(`\n📲 ${deviceConfig.name}`);

    const context = await browser.newContext({
      ...deviceConfig.device,
      colorScheme: 'light', // Force light mode
    });

    const page = await context.newPage();

    // Login first if we need authenticated pages
    const authPages = PAGES.filter(p => p.requiresAuth);
    if (authPages.length > 0) {
      try {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 10000 });

        // Try to login (adjust selectors as needed)
        await page.fill('[data-testid="username-input"]', USERNAME);
        await page.fill('[data-testid="password-input"]', PASSWORD);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/', { timeout: 5000 }).catch(() => {});
      } catch (e) {
        console.log(`   ⚠️  Could not login, some pages may not work`);
      }
    }

    for (const pageConfig of PAGES) {
      try {
        await page.goto(`${BASE_URL}${pageConfig.path}`, {
          waitUntil: 'networkidle',
          timeout: 10000
        });

        // Wait a bit for animations
        await page.waitForTimeout(500);

        const filename = `${deviceConfig.name}_${pageConfig.name}.png`;
        await page.screenshot({
          path: path.join(OUTPUT_DIR, filename),
          fullPage: false
        });

        console.log(`   ✅ ${pageConfig.name}`);
      } catch (e) {
        console.log(`   ❌ ${pageConfig.name}: ${e.message.split('\n')[0]}`);
      }
    }

    await context.close();
  }

  await browser.close();

  console.log(`\n✨ Done! Screenshots saved to: ${OUTPUT_DIR}\n`);

  // List generated files
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`Generated ${files.length} screenshots:\n`);
  files.forEach(f => console.log(`   ${f}`));
}

run().catch(console.error);
