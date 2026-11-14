#!/usr/bin/env node
/**
 * Captures real screens of the VYRA app for the marketing site.
 *
 * It drives the exported Expo web build against a running local API with a
 * synthetic person ("Asha", an example.test address, a plain colour field as
 * the photo), so no screenshot contains anyone's personal data.
 *
 *   pnpm services:start && pnpm build
 *   (cd apps/api && CORS_ORIGINS=http://localhost:8099 node dist/main.js) &
 *   pnpm --filter @vyra/mobile export:web
 *   node apps/landing/scripts/capture-app-screens.cjs [output-dir]
 *
 * Output defaults to docs/design-reference/app. Nothing here is mocked: a screen
 * that is an empty state in the app is an empty state in the screenshot.
 */
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const repo = path.resolve(__dirname, '../../..');
const root = path.join(repo, 'apps/mobile/dist');
const out = path.resolve(process.argv[2] ?? path.join(repo, 'docs/design-reference/app'));
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

const API = 'http://localhost:4000/v1';
const answer = (value, why) => ({ value, confidence: 'high', why });

async function call(pathname, body, token, method = 'POST') {
  const response = await fetch(API + pathname, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

/**
 * A second invented person, built through the public API: a profile, a plain
 * colour field as the photo (checked by the real moderation pipeline), and an
 * approved persona. Deleted through the API when the capture finishes.
 */
async function createSyntheticPerson(name) {
  const email = `${name.toLowerCase()}-${Date.now()}@example.test`;
  const code = await call('/auth/otp/request', { channel: 'email', destination: email });
  const verified = await call('/auth/otp/verify', {
    channel: 'email',
    destination: email,
    challengeId: code.challengeId,
    code: code.devCode,
  });
  const { accessToken: token } = await call('/auth/register', {
    registrationToken: verified.registrationToken,
    dateOfBirth: '1997-03-03',
    acceptedTermsVersion: '2026-11',
    acceptedPrivacyVersion: '2026-11',
  });
  await call(
    '/me/profile',
    {
      displayName: name,
      genderIdentity: 'MAN',
      bio: 'Cooks badly, walks well. Asks too many questions.',
    },
    token,
    'PATCH',
  );
  const browser = await chromium.launch();
  const scratch = await browser.newPage({ viewport: { width: 600, height: 750 } });
  await scratch.setContent(
    '<body style="margin:0;background:linear-gradient(200deg,#4b5d6b,#211d26)"></body>',
  );
  const png = await scratch.screenshot();
  await browser.close();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'p.png');
  await fetch(`${API}/me/photos`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  await call('/me/relationship-intents', { intents: [{ kind: 'serious' }] }, token, 'PUT');
  await call(
    '/me/discovery-preferences',
    { minAge: 22, maxAge: 40, maxDistanceKm: null, showGenders: ['WOMAN'], showAstrology: false },
    token,
    'PUT',
  );
  await call(
    '/me/location',
    { source: 'manual', countryCode: 'IN', placeId: 'gn:1277333' },
    token,
    'PUT',
  );
  await call('/me/consents/AI_IMPORT_PROCESSING', { granted: true }, token, 'PUT');
  await call(
    '/me/persona/assistant-reflection',
    {
      assistant: 'chatgpt',
      reply: JSON.stringify({
        vyra_questionnaire: '1',
        answers: {
          socialEnergy: answer(3, 'Happy in company and alone'),
          emotionalExpressiveness: answer(4, 'Says what he feels'),
          conflictApproach: answer(5, 'Prefers to sort things out quickly'),
          affectionExpression: answer(4, 'Openly affectionate'),
          communicationStyle: answer('expansive', 'Explains things in detail'),
          lifestylePace: answer('balanced', 'Some nights out, some in'),
          values: answer(['honesty', 'kindness', 'growth'], 'Talks about these often'),
        },
      }),
    },
    token,
  );
  await call('/me/persona/draft/approve', null, token);
  for (let i = 0; i < 60; i += 1) {
    const me = await call('/me', null, token, 'GET');
    if (me.photos[0]?.status !== 'PENDING') break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await call('/me/onboarding/complete', null, token);
  return { token };
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const page = await context.newPage();

  const snap = async (name) => {
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(`  ${name}.png`);
  };
  const button = (name) => page.getByRole('button', { name, exact: true });
  const heading = (text) => page.getByText(text, { exact: true });

  // A plain colour field stands in for a portrait; no real person is pictured.
  const photoPath = path.join(os.tmpdir(), `vyra-capture-${Date.now()}.png`);
  const scratch = await context.newPage();
  await scratch.setViewportSize({ width: 800, height: 1000 });
  await scratch.setContent(
    '<body style="margin:0;background:linear-gradient(160deg,#7a5c4d,#2b2530)"></body>',
  );
  await scratch.screenshot({ path: photoPath });
  await scratch.close();

  const email = `asha-${Date.now()}@example.test`;

  await page.goto(ORIGIN, { waitUntil: 'networkidle' });
  await heading('Chemistry, decoded.').waitFor();
  await page.waitForTimeout(1500); // let the brand animation settle
  await snap('01-welcome');

  await button('Continue with e-mail').click();
  await page.getByLabel('E-mail address').fill('asha@example.test');
  await snap('02-sign-in');
  await page.getByLabel('E-mail address').fill(email);
  await button('Send code').click();
  // The verify screen shows a development-only code hint, so it is not captured.
  const hint = await page.getByText(/Your code is \d{6}/).textContent();
  await page.getByLabel('Verification code').fill(/\d{6}/.exec(hint)[0]);

  await heading('When were you born?').waitFor();
  await page.getByLabel('Day').fill('12');
  await page.getByLabel('Month').fill('04');
  await page.getByLabel('Year').fill('1998');
  await snap('03-age');
  await button('Continue').click();

  await heading('How VYRA treats you.').waitFor();
  await page.getByRole('checkbox', { name: 'I agree to the Terms of Service' }).click();
  await page.getByRole('checkbox', { name: 'I agree to the Privacy Policy' }).click();
  await snap('04-consent');
  await button('Agree and create account').click();

  await heading('Let’s start with you.').waitFor();
  await page.getByLabel('Name', { exact: true }).fill('Asha');
  await page.getByRole('radio', { name: 'Woman' }).click();
  await page
    .getByLabel('A few lines about you (optional)')
    .fill('Designer. Reads on trains. Will argue about filter coffee.');
  await snap('05-onboarding-identity');
  await button('Continue').click();

  await heading('Show yourself.').waitFor();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add a photo' }).first().click();
  await (await chooser).setFiles(photoPath);
  await page.getByRole('button', { name: /^Photo 1/ }).waitFor({ timeout: 20000 });
  for (let i = 0; i < 120; i += 1) {
    const label =
      (await page.getByRole('button', { name: /^Photo 1/ }).getAttribute('aria-label')) ?? '';
    if (!label.includes('Checking')) break;
    await page.waitForTimeout(500);
  }
  await snap('06-onboarding-photos');
  await button('Continue').click();

  await heading('What pulls you in?').waitFor();
  for (const interest of ['Specialty coffee', 'Literary fiction']) {
    await page.getByRole('checkbox', { name: interest }).click();
  }
  // Pick two more of whatever the catalogue offers so the screen reads as lived-in.
  const others = page.getByRole('checkbox', { checked: false });
  await others.nth(3).click();
  await others.nth(7).click();
  await snap('07-onboarding-interests');
  await page.getByRole('button', { name: /^Continue with \d/ }).click();

  await heading('What are you here for?').waitFor();
  await page.getByRole('checkbox', { name: 'Something serious' }).click();
  await snap('08-onboarding-intention');
  await button('Continue').click();

  await heading('Help VYRA understand you.').waitFor();
  await page.getByRole('checkbox', { name: 'Draft a persona from my profile' }).click();
  await snap('09-onboarding-understand');
  await button('Ask the AI you use').click();

  await heading('Which assistant knows you best?').waitFor();
  await page.getByRole('radio', { name: 'ChatGPT' }).click();
  await snap('10-ask-ai-pick');
  await button('Continue').click();
  await heading('Copy the questions.').waitFor();
  await button('Copy questions').click();
  await button('Copied').waitFor();
  await snap('11-ask-ai-copy');
  await button('I have the answer').click();

  await heading('Paste the answer.').waitFor();
  const reply = [
    '```json',
    JSON.stringify(
      {
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
      },
      null,
      1,
    ),
    '```',
  ].join('\n');
  await page.getByLabel('Assistant’s reply').fill(reply);
  await page.getByRole('checkbox', { name: 'Let VYRA read the answers I paste' }).click();
  await snap('12-ask-ai-paste');
  await button('Read the answers').click();

  await heading('Is this you?').waitFor({ timeout: 15000 });
  await page.getByText('Thoughtful and considered').waitFor();
  await snap('13-persona-review');
  await button('Change Social energy').click();
  await page.getByRole('dialog', { name: 'Social energy' }).waitFor();
  await page.getByRole('radio', { name: 'In between' }).click();
  await snap('14-persona-edit');
  await button('Save').click();
  await page
    .getByRole('button', { name: 'That’s right Social energy' })
    .waitFor({ state: 'detached' });
  await button('Approve and continue').click();

  await heading('Where are you?').waitFor();
  await button('Choose a city').click();
  await page.getByLabel('City', { exact: true }).fill('beng');
  await button('Bengaluru, Karnataka').click();
  await snap('15-onboarding-location');
  await button('Use Bengaluru').click();
  await page.getByText(/measured from the city centre/).waitFor();
  await snap('16-onboarding-location-set');
  await button('Continue').click();

  await heading('Who should we look for?').waitFor();
  await page.getByRole('checkbox', { name: 'Men', exact: true }).click();
  await page.getByRole('radio', { name: 'Within 25 km' }).click();
  await snap('17-onboarding-preferences');
  await button('Continue').click();

  await heading('What matters to you?').waitFor();
  await page.getByRole('radio', { name: 'Pace of life: Preference' }).click();
  await page.getByRole('checkbox', { name: 'A mix of in and out' }).click();
  await page.getByRole('radio', { name: 'Values (at least one shared): Must-have' }).click();
  await page.getByRole('checkbox', { name: 'Honesty' }).click();
  await page.getByRole('checkbox', { name: 'Kindness' }).click();
  await snap('26-onboarding-matters');
  await button('Finish').click();

  await page.getByRole('tab', { name: 'Orbit', selected: true }).waitFor({ timeout: 15000 });
  await snap('18-orbit-empty');
  // A second synthetic person, so that Discover has someone real to show.
  const ravi = await createSyntheticPerson('Ravi');
  await page.getByRole('tab', { name: 'Discover' }).click();
  const card = page.getByRole('link', { name: /^Ravi,/ });
  await card.waitFor({ timeout: 20000 });
  await snap('19-discover-list');
  await card.click();
  await heading('Ravi').waitFor();
  await page.getByText('Estimated alignment', { exact: true }).waitFor();
  await snap('27-person-profile');
  await button('Back').click();

  for (const [tab, file] of [
    ['Connections', '20-connections-empty'],
    ['Messages', '21-messages-empty'],
    ['You', '22-you'],
  ]) {
    await page.getByRole('tab', { name: tab }).click();
    await page.getByRole('tab', { name: tab, selected: true }).waitFor();
    await snap(file);
  }

  await page.getByRole('link', { name: /^Your persona/ }).click();
  await page.getByText('These are new suggestions.', { exact: false }).waitFor({ timeout: 20000 });
  await snap('23-persona-suggestions');
  await button('Approve').click();
  await heading('Your persona.').waitFor();
  await snap('24-persona-approved');
  await button('Back').click();

  // Leave nothing behind: the synthetic account is deleted through the app itself.
  await page.getByRole('tab', { name: 'You' }).click();
  await button('Delete account').click();
  await page.getByRole('dialog', { name: 'Delete your account?' }).waitFor();
  await snap('25-delete-confirm');
  await button('Delete everything').click();
  await heading('Chemistry, decoded.').waitFor({ timeout: 15000 });

  await call('/me', { confirm: 'DELETE' }, ravi.token, 'DELETE');
  await browser.close();
  fs.rmSync(photoPath, { force: true });
  console.log(`Captured to ${out}`);
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
