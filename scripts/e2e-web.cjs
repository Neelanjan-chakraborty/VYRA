#!/usr/bin/env node
/**
 * Drives the exported web build through the whole account lifecycle against a
 * running API: sign-up, onboarding, session restore, sign-in, settings and
 * account deletion, plus the under-age refusal. Screenshots every step.
 *
 *   CORS_ORIGINS=http://localhost:8099 node apps/api/dist/main.js &
 *   pnpm --filter @vyra/mobile export:web
 *   pnpm e2e:web [output-dir]
 *
 * Needs Playwright with Chromium on the machine. A local QA aid, not part of CI.
 * One run requests four codes; the API allows five a minute per address, so wait
 * a minute between runs.
 */
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../apps/mobile/dist');
const out = path.resolve(process.argv[2] ?? 'visual-check-output');
const PORT = 8099;
const ORIGIN = `http://localhost:${PORT}`;
const TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('No web export found. Run: pnpm --filter @vyra/mobile export:web');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  const requested = path.join(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
  const isFile =
    requested.startsWith(root) && fs.existsSync(requested) && fs.statSync(requested).isFile();
  const file = isFile ? requested : path.join(root, 'index.html');
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const page = await context.newPage();
  const problems = [];
  // Expected: 401/403 while signed out or after deletion, and the 422 the test provokes
  // with an unusable pasted reply. Anything else is a defect.
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 4(01|03|22)/.test(message.text()))
      problems.push(`console: ${message.text()}`);
  });

  let shot = 0;
  const snap = async (name) => {
    shot += 1;
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, `${String(shot).padStart(2, '0')}-${name}.png`) });
  };
  const step = async (name, action) => {
    try {
      await action();
    } catch (error) {
      await page.screenshot({ path: path.join(out, `FAILED-${name}.png`) });
      const seen = problems.length > 0 ? `\nBrowser reported:\n  - ${problems.join('\n  - ')}` : '';
      throw new Error(
        `Step "${name}" failed: ${error.message.split('\n').slice(0, 12).join('\n')}${seen}`,
        {
          cause: error,
        },
      );
    }
  };
  const button = (name) => page.getByRole('button', { name, exact: true });
  const heading = (text) => page.getByText(text, { exact: true });

  // A plain test image, large enough to pass the upload size rule.
  const photoPath = path.join(os.tmpdir(), `vyra-e2e-${Date.now()}.png`);
  const scratch = await context.newPage();
  await scratch.setViewportSize({ width: 800, height: 1000 });
  await scratch.setContent(
    '<body style="margin:0;background:linear-gradient(160deg,#7a5c4d,#2b2530)"></body>',
  );
  await scratch.screenshot({ path: photoPath });
  await scratch.close();

  const email = `e2e-${Date.now()}@example.test`;

  async function signInWithEmail(address) {
    await button('Continue with e-mail').click();
    await page.getByLabel('E-mail address').fill(address);
    await button('Send code').click();
    const hint = await page.getByText(/Your code is \d{6}/).textContent();
    await page.getByLabel('Verification code').fill(/\d{6}/.exec(hint)[0]);
  }
  async function enterBirthDate(day, month, year) {
    await page.getByLabel('Day').fill(day);
    await page.getByLabel('Month').fill(month);
    await page.getByLabel('Year').fill(year);
    await button('Continue').click();
  }

  await step('welcome', async () => {
    await page.goto(ORIGIN, { waitUntil: 'networkidle' });
    await heading('Chemistry, decoded.').waitFor();
    await snap('welcome');
  });

  await step('under-age refusal', async () => {
    await signInWithEmail(`e2e-minor-${Date.now()}@example.test`);
    await heading('When were you born?').waitFor();
    await enterBirthDate('01', '06', String(new Date().getFullYear() - 16));
    await page.getByText(/VYRA is for people aged 18 and over/).waitFor();
    await snap('underage');
    await button('Close').click();
    await heading('Chemistry, decoded.').waitFor();
  });

  await step('validation errors', async () => {
    await button('Continue with e-mail').click();
    await page.getByLabel('E-mail address').fill('not-an-email');
    await button('Send code').click();
    await page.getByRole('alert').waitFor();
    await snap('sign-in-error');
    await button('Back').click();
  });

  await step('sign up', async () => {
    await button('Continue with e-mail').click();
    await page.getByLabel('E-mail address').fill(email);
    await snap('sign-in');
    await button('Send code').click();
    await page.getByText(/Your code is \d{6}/).waitFor();
    await snap('verify');
    await page.getByLabel('Verification code').fill('000000');
    await page.getByRole('alert').waitFor(); // wrong code is refused
    const hint = await page.getByText(/Your code is \d{6}/).textContent();
    await page.getByLabel('Verification code').fill(/\d{6}/.exec(hint)[0]);
    await heading('When were you born?').waitFor();
    await snap('age');
    await enterBirthDate('12', '04', '1998');
    await heading('How VYRA treats you.').waitFor();
    if (!(await button('Agree and create account').isDisabled()))
      throw new Error('consent not required');
    await page.getByRole('checkbox', { name: 'I agree to the Terms of Service' }).click();
    await page.getByRole('checkbox', { name: 'I agree to the Privacy Policy' }).click();
    await snap('consent');
    await button('Agree and create account').click();
  });

  await step('onboarding: identity', async () => {
    await heading('Let’s start with you.').waitFor();
    await button('Continue').click();
    await page.getByText('Tell us what to call you').waitFor(); // name is required
    await page.getByLabel('Name', { exact: true }).fill('Asha');
    await page.getByLabel('City (optional)').fill('Bengaluru');
    await page
      .getByLabel('A few lines about you (optional)')
      .fill('Designer. Reads on trains. Will argue about filter coffee.');
    await snap('onboarding-identity');
    await button('Continue').click();
  });

  await step('onboarding: photos', async () => {
    await heading('Show yourself.').waitFor();
    if (!(await button('Continue').isDisabled())) throw new Error('a photo should be required');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add a photo' }).first().click();
    await (await chooser).setFiles(photoPath);
    await page.getByRole('button', { name: /^Photo 1/ }).waitFor({ timeout: 20000 });
    await snap('onboarding-photos');
    await button('Continue').click();
  });

  await step('onboarding: interests', async () => {
    await heading('What pulls you in?').waitFor();
    await page.getByRole('checkbox', { name: 'Specialty coffee' }).click();
    await page.getByRole('checkbox', { name: 'Literary fiction' }).click();
    await snap('onboarding-interests');
    await button('Continue with 2').click();
  });

  await step('onboarding: intention', async () => {
    await heading('What are you here for?').waitFor();
    await page.getByRole('checkbox', { name: 'Something serious' }).click();
    await page.getByRole('checkbox', { name: 'Something else' }).click();
    await page.getByLabel('In your words').fill('A travel partner');
    await snap('onboarding-intention');
    await button('Continue').click();
  });

  await step('onboarding: understand', async () => {
    await heading('Help VYRA understand you.').waitFor();
    await page.getByRole('checkbox', { name: 'Draft a persona from my profile' }).click();
    await page
      .getByRole('checkbox', { name: 'Draft a persona from my profile', checked: true })
      .waitFor();
    await snap('onboarding-understand');
    await button('Ask the AI you use').click();
  });

  await step('ask your AI: choose and copy', async () => {
    await heading('Which assistant knows you best?').waitFor();
    await page.getByRole('radio', { name: 'ChatGPT' }).click();
    await snap('ask-ai-pick');
    await button('Continue').click();
    await heading('Copy the questions.').waitFor();
    await button('Copy questions').click();
    await button('Copied').waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    if (!copied.includes('"vyra_questionnaire"') || !copied.includes('socialEnergy —')) {
      throw new Error('clipboard does not hold the questionnaire');
    }
    await button('Read the questions first').click();
    await snap('ask-ai-copy');
    await button('I have the answer').click();
  });

  await step('ask your AI: paste the reply', async () => {
    await heading('Paste the answer.').waitFor();
    // An unusable reply is explained and nothing is saved.
    await page.getByLabel('Assistant’s reply').fill('Sorry, I don’t remember anything about you.');
    await page.getByRole('checkbox', { name: 'Let VYRA read the answers I paste' }).click();
    await button('Read the answers').click();
    await page.getByText(/couldn’t find the answers/).waitFor();
    await snap('ask-ai-error');
    const reply = [
      'Here you go:',
      '```json',
      JSON.stringify({
        vyra_questionnaire: '1',
        answers: {
          socialEnergy: {
            value: 2,
            confidence: 'high',
            why: 'Prefers small dinners to big parties',
          },
          conflictApproach: {
            value: 5,
            confidence: 'medium',
            why: 'Likes to talk problems through',
          },
          communicationStyle: {
            value: 'reflective',
            confidence: 'medium',
            why: 'Writes long, considered messages',
          },
          weekendRhythm: { value: 'unknown', confidence: 'low', why: '' },
        },
      }),
      '```',
    ].join('\n');
    await page.evaluate((text) => navigator.clipboard.writeText(text), reply);
    await page.getByLabel('Assistant’s reply').fill('');
    await button('Paste from clipboard').click();
    await button('Read the answers').click();
  });

  await step('persona review in onboarding', async () => {
    await heading('Is this you?').waitFor({ timeout: 15000 });
    await page.getByText('Prefers small dinners to big parties — from ChatGPT').waitFor();
    await page.getByText('Thoughtful and considered').waitFor();
    await snap('persona-review');
    // Correct one answer: it moves to "You told us".
    await button('Change Social energy').click();
    await page.getByRole('dialog', { name: 'Social energy' }).waitFor();
    await page.getByRole('radio', { name: 'In between' }).click();
    await snap('persona-edit');
    await button('Save').click();
    await page
      .getByRole('button', { name: 'That’s right Social energy' })
      .waitFor({ state: 'detached' });
    await button('Approve and continue').click();
  });

  await step('onboarding: preferences', async () => {
    await heading('Who should we look for?').waitFor();
    await button('Increase Oldest').click();
    await page.getByRole('radio', { name: 'Within 25 km' }).click();
    await snap('onboarding-preferences');
    await button('Finish').click();
  });

  await step('signed-in app', async () => {
    await page.getByRole('tab', { name: 'Orbit', selected: true }).waitFor({ timeout: 15000 });
    await snap('orbit');
    await page.getByRole('tab', { name: 'You' }).click();
    await heading('Asha, 28').waitFor();
    await page.getByText('Something serious · A travel partner').waitFor();
    await page.getByText('Ages 24–35, within 25 km').waitFor();
    await snap('you');
  });

  await step('persona from settings', async () => {
    await page.getByRole('link', { name: /^Your persona/ }).click();
    await heading('Your persona.')
      .waitFor({ timeout: 15000 })
      .catch(() => heading('Is this you?').waitFor());
    // The profile-based suggestions requested during onboarding arrive as a new draft.
    await page
      .getByText('These are new suggestions.', { exact: false })
      .waitFor({ timeout: 15000 });
    await page.getByText('Somewhere in between').waitFor(); // the person's own answer survived
    await snap('persona-settings');
    await button('Approve').click();
    await heading('Your persona.').waitFor();
    await page.getByRole('switch', { name: 'Suggestions from my profile', checked: true }).click();
    await page
      .getByRole('switch', { name: 'Suggestions from my profile', checked: false })
      .waitFor();
    await button('Back').click();
    await page.getByText(/things approved/).waitFor();
  });

  await step('session survives a reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await heading('Asha, 28').waitFor({ timeout: 15000 });
  });

  await step('edit profile from settings', async () => {
    await page.getByRole('link', { name: /^About you/ }).click();
    await heading('About you.').waitFor();
    await page.getByLabel('What you do (optional)').fill('Product designer');
    await snap('settings-profile');
    await button('Save').click();
    await page.getByText('Product designer').waitFor();
    const visibility = page.getByRole('switch', { name: 'Visible to others', checked: true });
    // Centre it: the floating tab bar covers the bottom edge of the viewport.
    await visibility.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await visibility.click();
    await page.getByText('Hidden. Nobody new will see you.').waitFor();
  });

  await step('layout at small and large sizes', async () => {
    for (const [name, width, height] of [
      ['small', 320, 568],
      ['large', 820, 1180],
    ]) {
      await page.setViewportSize({ width, height });
      for (const tab of ['Orbit', 'Discover', 'Connections', 'Messages', 'You']) {
        await page.getByRole('tab', { name: tab }).click();
        await page.getByRole('tab', { name: tab, selected: true }).waitFor();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        if (overflow) throw new Error(`${tab} overflows horizontally at ${width}pt`);
      }
      await snap(`you-${name}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await step('sign out and back in', async () => {
    await button('Sign out').click();
    await heading('Chemistry, decoded.').waitFor();
    await signInWithEmail(email);
    // A returning person skips registration and onboarding entirely.
    await page.getByRole('tab', { name: 'Orbit', selected: true }).waitFor({ timeout: 15000 });
  });

  await step('delete account', async () => {
    await page.getByRole('tab', { name: 'You' }).click();
    await button('Delete account').click();
    await page.getByRole('dialog', { name: 'Delete your account?' }).waitFor();
    await snap('delete-confirm');
    await button('Delete everything').click();
    await heading('Chemistry, decoded.').waitFor({ timeout: 15000 });
    // The address is free again: signing in now asks for registration, not a session.
    await signInWithEmail(email);
    await heading('When were you born?').waitFor();
  });

  await browser.close();
  fs.rmSync(photoPath, { force: true });
  if (problems.length > 0)
    throw new Error(`Browser reported problems:\n  - ${problems.join('\n  - ')}`);
  console.log(`Account lifecycle passed. ${shot} screenshots in ${out}`);
}

server.listen(PORT, () => {
  main()
    .then(() => server.close())
    .catch((error) => {
      console.error(error.message);
      server.close();
      process.exit(1);
    });
});
