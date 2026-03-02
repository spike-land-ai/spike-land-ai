import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to http://localhost:5173/live/pixie...");
  try {
    await page.goto('http://localhost:5173/live/pixie', { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log("Navigation timeout or error, continuing anyway...");
  }
  
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Looking for Open Chat button...");
  const chatButton = page.locator('button[aria-label="Open Chat"]');
  if (await chatButton.isVisible()) {
    console.log("Clicking Open Chat button...");
    await chatButton.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log("Checking UI state...");
  const chatExists = await page.evaluate(() => !!document.querySelector('textarea[placeholder="Ask me anything..."]'));
  const monacoExists = await page.evaluate(() => !!document.querySelector('.monaco-editor'));
  const draggableExists = await page.evaluate(() => !!document.querySelector('[data-testid="draggable-window-content"]'));
  
  console.log("Chat Interface (textarea) exists:", chatExists);
  console.log("Monaco Editor exists:", monacoExists);
  console.log("Draggable Window Content exists:", draggableExists);
  
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
