// Launches Playwright using the local Chrome profile so manual runs reuse saved authentication state.
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const DEFAULT_USER_DATA_DIRECTORIES = {
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
  win32: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  linux: path.join(os.homedir(), '.config', 'google-chrome'),
};

const resolveUserDataDir = () => {
  const fallbackDir = DEFAULT_USER_DATA_DIRECTORIES[process.platform];
  return process.env.PLAYWRIGHT_CHROME_USER_DATA_DIR || fallbackDir;
};

const userDataDir = resolveUserDataDir();

if (!userDataDir) {
  console.error('Unable to determine a Chrome user data directory. Set PLAYWRIGHT_CHROME_USER_DATA_DIR.');
  process.exit(1);
}

const profileDirectory =
  process.env.PLAYWRIGHT_CHROME_PROFILE ||
  (process.platform === 'darwin' ? 'Profile 6' : 'Default');

const startUrl = process.env.PLAYWRIGHT_PROFILE_START_URL || process.env.PLAYWRIGHT_BASE_URL || 'https://example.com';
const headless = process.env.PLAYWRIGHT_PERSISTENT_HEADLESS === 'true';

(async () => {
  console.log(`Launching Chrome with persistent profile from ${userDataDir} (profile: ${profileDirectory})`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    channel: 'chrome',
    args: [`--profile-directory=${profileDirectory}`],
  });

  const [existingPage] = context.pages();
  const page = existingPage || (await context.newPage());

  await page.goto(startUrl);
  await page.pause();

  await context.close();
})().catch((error) => {
  console.error('Failed to launch persistent Chrome session:', error);
  process.exit(1);
});
