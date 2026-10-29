// Shared Chromium launcher for local Playwright tests on Windows, macOS and Linux.
const { chromium } = require('playwright');

async function launchBrowser() {
  const options = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
  // Optional override for CI or an existing system Chromium installation.
  if (process.env.CHROMIUM_PATH) options.executablePath = process.env.CHROMIUM_PATH;
  try {
    return await chromium.launch(options);
  } catch (error) {
    console.error('Cannot start Chromium. Run "npx playwright install chromium"');
    if (process.env.CHROMIUM_PATH) console.error('Check CHROMIUM_PATH:', process.env.CHROMIUM_PATH);
    throw error;
  }
}

module.exports = { launchBrowser };
