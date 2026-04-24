import { expect, test } from '@playwright/test';

test('keyboard mode completes a quote and records stats', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Keyboard' }).click();

  const targetText = await page.getByLabel('Target text').innerText();
  await page.getByLabel('Typing input').fill(targetText);

  await expect(page.getByLabel('Typing input')).toHaveValue('');
});

test('voice mode handles multi-segment transcripts with spaces', async ({ page }) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      static instances: MockSpeechRecognition[] = [];
      static async available() {
        return 'available';
      }
      continuous = false;
      interimResults = false;
      lang = '';
      processLocally = false;
      onresult: ((event: { results: ArrayLike<any> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        MockSpeechRecognition.instances.push(this);
      }
      stop() {
        this.onend?.();
      }
      emit(transcripts: string[]) {
        this.onresult?.({
          results: transcripts.map((transcript) => [{ transcript }]),
        });
      }
    }

    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).MockSpeechRecognition = MockSpeechRecognition;
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Voice' }).click();
  const targetWords = (await page.getByLabel('Target text').innerText()).split(/\s+/);
  await page.getByRole('button', { name: 'Start Voice' }).click();

  await page.evaluate((words) => {
    const recognition = (window as any).MockSpeechRecognition.instances[0];
    recognition.emit([words.slice(0, 2).join(' '), ` ${words[2]}`]);
  }, targetWords);

  await expect(page.getByTestId('char-0')).toHaveClass(/is-correct/);
  await expect(page.getByLabel('3 accepted words')).toBeVisible();
});

test('does not make external runtime requests', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      externalRequests.push(request.url());
    }
  });

  await page.goto('/');

  expect(externalRequests).toEqual([]);
});

test('static assets have expected content types', async ({ request }) => {
  const index = await request.get('/');
  await expect(index).toBeOK();
  expect(index.headers()['content-type']).toContain('text/html');

  const staleCss = await request.get('/index.css');
  await expect(staleCss).toBeOK();
  expect(staleCss.headers()['content-type']).toContain('text/css');

  const ogImage = await request.get('/og-image.png');
  await expect(ogImage).toBeOK();
  expect(ogImage.headers()['content-type']).toContain('image/png');

  const favicon = await request.get('/favicon.png');
  await expect(favicon).toBeOK();
  expect(favicon.headers()['content-type']).toContain('image/png');

  const sitemap = await request.get('/sitemap.xml');
  await expect(sitemap).toBeOK();
  expect(sitemap.headers()['content-type']).toContain('xml');

  const robots = await request.get('/robots.txt');
  await expect(robots).toBeOK();
  expect(robots.headers()['content-type']).toContain('text/plain');
});
