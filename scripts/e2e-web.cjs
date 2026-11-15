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

const API = 'http://localhost:4000/v1';

function psql(sql) {
  // Development database only: used to put the test into states a user can't reach directly.
  require('node:child_process').execSync(
    `psql postgresql://vyra:vyra@localhost:5432/vyra_dev -qc "${sql}"`,
  );
}

/** One value from the development database. */
function psqlValue(sql) {
  return require('node:child_process')
    .execSync(`psql postgresql://vyra:vyra@localhost:5432/vyra_dev -tAc "${sql}"`)
    .toString()
    .trim();
}

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

/** Registers someone through the public API and returns their tokens. */
async function apiSession(email) {
  // Code requests are limited to five a minute per address; wait out the limit rather than fail.
  let code;
  for (let attempt = 0; !code; attempt += 1) {
    try {
      code = await call('/auth/otp/request', { channel: 'email', destination: email });
    } catch (error) {
      if (!error.message.endsWith(': 429') || attempt >= 8) throw error;
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  const verified = await call('/auth/otp/verify', {
    channel: 'email',
    destination: email,
    challengeId: code.challengeId,
    code: code.devCode,
  });
  return call('/auth/register', {
    registrationToken: verified.registrationToken,
    dateOfBirth: '1997-03-03',
    acceptedTermsVersion: '2026-11',
    acceptedPrivacyVersion: '2026-11',
  });
}

/** A finished, discoverable man in Bengaluru looking for women, built through the API. */
async function createApiPerson(name) {
  const tokens = await apiSession(`${name.toLowerCase()}@example.test`);
  const t = tokens.accessToken;
  await call(
    '/me/profile',
    { displayName: name, genderIdentity: 'MAN', bio: 'Cooks badly, walks well.' },
    t,
    'PATCH',
  );
  const png = Buffer.from(
    await (await chromium.launch()).newPage().then(async (p) => {
      await p.setViewportSize({ width: 600, height: 750 });
      await p.setContent(
        '<body style="margin:0;background:linear-gradient(200deg,#4b5d6b,#211d26)"></body>',
      );
      const shot = await p.screenshot();
      await p.context().browser().close();
      return shot;
    }),
  );
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'p.png');
  const photo = await (
    await fetch(`${API}/me/photos`, {
      method: 'POST',
      headers: { authorization: `Bearer ${t}` },
      body: form,
    })
  ).json();
  await call('/me/relationship-intents', { intents: [{ kind: 'serious' }] }, t, 'PUT');
  await call(
    '/me/discovery-preferences',
    { minAge: 22, maxAge: 40, maxDistanceKm: null, showGenders: ['WOMAN'], showAstrology: false },
    t,
    'PUT',
  );
  await call(
    '/me/location',
    { source: 'manual', countryCode: 'IN', placeId: 'gn:1277333' },
    t,
    'PUT',
  );
  // Wait for the real moderation pipeline to finish with the upload first.
  for (let i = 0; i < 60; i += 1) {
    const me = await call('/me', null, t, 'GET');
    if (me.photos[0]?.status !== 'PENDING') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await call('/me/onboarding/complete', null, t);
  return { photoId: photo.id, token: t };
}

async function main() {
  // A fake microphone, so voice notes can be recorded headless.
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.grantPermissions(
    ['clipboard-read', 'clipboard-write', 'geolocation', 'microphone'],
    {
      origin: ORIGIN,
    },
  );
  // A precise device position in Bengaluru; VYRA must store and show only a rough area.
  await context.setGeolocation({ latitude: 12.971942, longitude: 77.593689 });
  const page = await context.newPage();
  const problems = [];
  // Expected: 401/403 while signed out or after deletion, and the 422 the test provokes
  // with an unusable pasted reply. Anything else is a defect.
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  // Say which response failed; the console message alone doesn't. Signatures are dropped.
  page.on('response', (response) => {
    if (response.status() === 404) problems.push(`404: ${new URL(response.url()).pathname}`);
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? '';
    if (reason.includes('BLOCKED')) problems.push(`${reason}: ${new URL(request.url()).pathname}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 4(01|03|22)/.test(message.text()))
      if (!/status of 404/.test(message.text())) problems.push(`console: ${message.text()}`);
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
  // A screen title. Names also appear on cards in tabs that stay mounted underneath.
  const title = (text) => page.getByRole('heading', { name: text, exact: true });

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
    await page.getByRole('radio', { name: 'Woman' }).click();
    await page.getByRole('switch', { name: 'Show gender on my profile', checked: false }).waitFor();
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
    // The real moderation pipeline (open-source classifier in the API's worker) checks it;
    // the tile is labelled "Checking" until then. Wait for the verdict.
    let label = '';
    for (let i = 0; i < 120; i += 1) {
      label =
        (await page.getByRole('button', { name: /^Photo 1/ }).getAttribute('aria-label')) ?? '';
      if (!label.includes('Checking')) break;
      await page.waitForTimeout(500);
    }
    if (/Checking|In review|Not approved/.test(label))
      throw new Error(`photo was not approved: ${label}`);
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

  await step('onboarding: location (manual city)', async () => {
    await heading('Where are you?').waitFor();
    await page.getByText('Not set', { exact: true }).waitFor();
    await button('Choose a city').click();
    await page.getByLabel('City', { exact: true }).fill('beng');
    await button('Bengaluru, Karnataka').click();
    await page.getByLabel('Area or neighbourhood (optional)').fill('Indiranagar');
    await snap('onboarding-location');
    await button('Use Bengaluru').click();
    await page.getByText('Indiranagar, Bengaluru, Karnataka', { exact: true }).waitFor();
    await page.getByText(/measured from the city centre/).waitFor();
    await button('Continue').click();
  });

  await step('onboarding: preferences', async () => {
    await heading('Who should we look for?').waitFor();
    await button('Increase Oldest').click();
    await page.getByRole('checkbox', { name: 'Men', exact: true }).click();
    // Choosing a gender reveals the "describe their gender differently" option, on by default.
    await page
      .getByRole('switch', {
        name: 'Also show people who describe their gender differently',
        checked: true,
      })
      .waitFor();
    await page.getByRole('radio', { name: 'Within 25 km' }).click();
    await snap('onboarding-preferences');
    await button('Continue').click();
  });

  await step('onboarding: what matters', async () => {
    await heading('What matters to you?').waitFor();
    await page.getByText(/Ages 24–35 · Your “show me” choice · Within 25 km/).waitFor();
    await page.getByRole('radio', { name: 'Pace of life: Preference' }).click();
    await page.getByRole('checkbox', { name: 'A mix of in and out' }).click();
    await page.getByRole('radio', { name: 'Values (at least one shared): Must-have' }).click();
    // A must-have with nothing chosen is refused with an explanation.
    await button('Finish').click();
    await page
      .getByRole('alert')
      .filter({ hasText: /Choose at least one option/ })
      .waitFor();
    await page.getByRole('checkbox', { name: 'Honesty' }).click();
    await page.getByRole('checkbox', { name: 'Kindness' }).click();
    await snap('onboarding-matters');
    await button('Finish').click();
  });

  await step('signed-in app', async () => {
    await page.getByRole('tab', { name: 'Orbit', selected: true }).waitFor({ timeout: 15000 });
    await snap('orbit');
    await page.getByRole('tab', { name: 'You' }).click();
    await heading('Asha, 28').waitFor();
    await page.getByText('Something serious · A travel partner').waitFor();
    await page.getByText('Ages 24–35, within 25 km').waitFor();
    await page.getByText('1 must-have, 1 preference').waitFor();
    await snap('you');
  });

  await step('discover: unapproved photos never show, approved ones do', async () => {
    // People left by earlier runs (and by the API test suites) would crowd this run's people out of the top 30.
    psql(
      `update user_profiles set is_discoverable=false where display_name ~ '^(Ravi|Kabir|Dev|Arjun)[0-9]+$' or display_name = 'Synthetic'`,
    );
    // A second person, created through the API, who fits the viewer's choices.
    const subjectName = `Ravi${Date.now() % 100000}`;
    const subject = await createApiPerson(subjectName);
    // Hold their photo in review, as moderation would for an uncertain image.
    psql(
      `update user_photos set moderation_status='REVIEW_REQUIRED', moderation_reason='possibly_explicit', moderated_at=now() where id='${subject.photoId}'`,
    );

    // Orbit already fetched recommendations before this person existed.
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Discover' }).click();
    const card = page.getByRole('link', { name: new RegExp(`^${subjectName},`) });
    await card.waitFor({ timeout: 15000 });
    await card.getByRole('img', { name: `No photo of ${subjectName} yet` }).waitFor();
    if ((await card.getByRole('img', { name: `Photo of ${subjectName}`, exact: true }).count()) > 0)
      throw new Error('unapproved photo shown');
    await page.getByText('Under 5 km away').first().waitFor();
    await snap('discover-placeholder');

    await card.click();
    await title(subjectName).waitFor();
    await page.getByRole('img', { name: `No photo of ${subjectName} yet` }).waitFor();
    await page.getByText('Estimated alignment', { exact: true }).waitFor();
    await snap('person-placeholder');
    await button('Back').click();

    // A moderator approves it; now — and only now — it appears.
    const moderator = await apiSession(`mod-${Date.now()}@example.test`);
    psql(
      `update users set role='MODERATOR' where id=(select user_id from auth_sessions order by created_at desc limit 1)`,
    );
    const decision = await fetch(`${API}/moderation/photos/${subject.photoId}/decision`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${moderator.accessToken}`,
      },
      body: JSON.stringify({ decision: 'approve', reason: 'looks_fine' }),
    });
    if (decision.status !== 204) throw new Error(`moderator decision failed: ${decision.status}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Discover' }).click();
    await page
      .getByRole('link', { name: new RegExp(`^${subjectName},`) })
      .getByRole('img', { name: `Photo of ${subjectName}`, exact: true })
      .waitFor({ timeout: 15000 });
    await snap('discover-approved');
    await page.getByRole('tab', { name: 'You' }).click();
  });

  /** The person Asha connects with in the discovery step; the messaging step talks to them. */
  let kabirForMessages = null;

  await step('discovery: orbit, filters, compatibility, connections, pass, block', async () => {
    const suffix = Date.now() % 100000;
    const [kabir, dev, arjun] = [`Kabir${suffix}`, `Dev${suffix}`, `Arjun${suffix}`];
    const kabirPerson = await createApiPerson(kabir);
    kabirForMessages = { name: kabir, token: kabirPerson.token };
    await createApiPerson(dev);
    await createApiPerson(arjun);
    await page.reload({ waitUntil: 'networkidle' });

    // Orbit: people sit around the centre; tapping one opens their profile.
    await page.getByRole('tab', { name: 'Orbit' }).click();
    await heading('Who’s near your centre.').waitFor({ timeout: 15000 });
    await page.getByRole('link', { name: new RegExp(`^${kabir},`) }).waitFor();
    await snap('orbit-people');
    await page.getByRole('link', { name: new RegExp(`^${kabir},`) }).click();
    await title(kabir).waitFor();
    await button('Back').click();
    await button('Zoom in').click();
    await button('Re-centre').click();
    await button('Show as a list').click();

    // Discover filters are counted views of the same list.
    await heading('Read people, don’t flick past them.').waitFor();
    await page.getByRole('radio', { name: /^Show: Nearby \d+/ }).click();
    await page.getByRole('radio', { name: /^Show: Nearby/, checked: true }).waitFor();
    await snap('discover-filters');
    await page.getByRole('radio', { name: /^Show: All/ }).click();

    // Full compatibility, then save: saved people move to Connections.
    const subjectCard = page.getByRole('link', { name: /^Ravi\d+,/ }).first();
    const subjectLabel = await subjectCard.getAttribute('aria-label');
    const subject = /^(Ravi\d+),/.exec(subjectLabel)[1];
    await subjectCard.click();
    await title(subject).waitFor();
    await page.getByText('Why you might connect', { exact: true }).waitFor();
    await snap('person-deep');
    await button('See the full picture').click();
    await title(`You and ${subject}`).waitFor();
    await page.getByText('Six ways of looking at it', { exact: true }).waitFor();
    await page.getByText('A first date', { exact: true }).waitFor();
    await snap('compatibility');
    await button('Back').click();
    await button('Save').click();
    await button('Saved').waitFor();
    await button('Back').click();

    // Someone asks Asha to connect; she accepts and it becomes mutual.
    const ashaId = psqlValue(`select id from users where email='${email}'`);
    await call(
      '/connections/requests',
      { recipientId: ashaId, note: 'Chai sometime?' },
      kabirPerson.token,
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Connections' }).click();
    await heading('People you’re getting to know.').waitFor();
    await page.getByText('“Chai sometime?”').waitFor();
    await snap('connections-request');
    await button('Accept').click();
    await page.getByRole('radio', { name: 'Show: Mutual' }).click();
    await page.getByRole('link', { name: new RegExp(`^${kabir},`) }).waitFor();
    await snap('connections-mutual');
    await page.getByRole('radio', { name: 'Show: Saved' }).click();
    await page.getByRole('link', { name: new RegExp(`^${subject},`) }).waitFor();

    // Asha asks someone with a note, sees it under Sent, and withdraws.
    await page.getByRole('tab', { name: 'Discover' }).click();
    await page.getByRole('link', { name: new RegExp(`^${dev},`) }).click();
    await title(dev).waitFor();
    await button('Connect').click();
    await page.getByLabel('Add a note (optional)').fill('You walk well too.');
    await snap('connect-note');
    await button('Send request').click();
    await page.getByText('Request sent', { exact: true }).waitFor();
    await button('Back').click();
    await page.getByRole('tab', { name: 'Connections' }).click();
    await page.getByRole('radio', { name: 'Show: Sent' }).click();
    await page.getByText('“You walk well too.”').waitFor();
    await button('Withdraw').click();
    await page.getByText('You haven’t asked anyone to connect.', { exact: false }).waitFor();

    // Pass: gone from Discover for 30 days.
    await page.getByRole('tab', { name: 'Discover' }).click();
    await button(`Pass on ${arjun}`).click();
    await page.getByText(`You passed on ${arjun}.`, { exact: false }).waitFor();
    // The list refreshes just after the confirmation; the person must then be gone everywhere.
    for (let i = 0; ; i += 1) {
      if ((await page.getByRole('link', { name: new RegExp(`^${arjun},`) }).count()) === 0) break;
      if (i > 40) throw new Error('passed person still listed');
      await page.waitForTimeout(250);
    }

    // Block from the profile: gone everywhere, listed in Settings, unblock restores.
    await page.getByRole('tab', { name: 'Connections' }).click();
    await page.getByRole('radio', { name: 'Show: Saved' }).click();
    await page.getByRole('link', { name: new RegExp(`^${subject},`) }).click();
    await title(subject).waitFor();
    await button('More options').click();
    await button(`Block ${subject}`).click();
    await heading(`Block ${subject}?`).waitFor();
    await snap('block-confirm');
    await button('Block').click();
    await heading('People you’re getting to know.').waitFor();
    await page.getByText('Nothing saved.', { exact: false }).waitFor();
    await page.getByRole('tab', { name: 'You' }).click();
    await page.getByRole('link', { name: 'Blocked people: 1 person' }).click();
    await page.getByText(subject, { exact: true }).last().waitFor();
    await snap('blocked-people');
    await button(`Unblock ${subject}`).click();
    await page.getByText('You haven’t blocked anyone.').waitFor();
    await button('Back').click();
  });

  await step('messaging: text, live reply, read, photo, voice, date idea, Wingman', async () => {
    const { name: kabir, token } = kabirForMessages;
    const { io } = require(require.resolve('socket.io-client', { paths: ['apps/mobile'] }));
    const [conversation] = (await call('/conversations', null, token, 'GET')).conversations;
    const conversationId = conversation.id;
    const kabirSocket = io('http://localhost:4000', {
      path: '/v1/socket',
      transports: ['websocket'],
      auth: { token },
    });
    await new Promise((resolve, reject) => {
      kabirSocket.on('connect', resolve);
      kabirSocket.on('connect_error', reject);
    });
    const kabirSays = (body) =>
      call(
        `/conversations/${conversationId}/messages`,
        { kind: 'text', clientId: require('node:crypto').randomUUID(), body },
        token,
      );

    try {
      // From Connections › Mutual into the conversation.
      await page.getByRole('tab', { name: 'Connections' }).click();
      await page.getByRole('radio', { name: 'Show: Mutual' }).click();
      await button(`Message ${kabir}`).click();
      await title(kabir).waitFor();
      await page.getByText(`You and ${kabir} are connected`, { exact: false }).waitFor();

      // Asha writes; Kabir types and answers; it arrives without a reload.
      await page.getByLabel('Message', { exact: true }).fill('Hi Kabir! Chai sounds good.');
      await button('Send').click();
      await page.getByText('Hi Kabir! Chai sounds good.', { exact: true }).waitFor();
      kabirSocket.emit('typing', { conversationId });
      await page.getByText('typing…', { exact: true }).waitFor({ timeout: 5000 });
      await snap('conversation-typing');
      await kabirSays('Great — Saturday?');
      await page.getByText('Great — Saturday?', { exact: true }).waitFor({ timeout: 10000 });

      // Kabir reads Asha's message: the tick appears (both share receipts).
      const latest = await call(`/conversations/${conversationId}/messages`, null, token, 'GET');
      await call(`/conversations/${conversationId}/read`, { upTo: latest.messages[0].id }, token);
      await page
        .getByText(/· Read$/)
        .first()
        .waitFor({ timeout: 10000 });

      // A photo: checked first, then shown.
      await page.getByRole('button', { name: /^Add a photo/ }).click();
      const chooser = page.waitForEvent('filechooser');
      await button('Photo').click();
      await (await chooser).setFiles(photoPath);
      await page.getByRole('img', { name: 'Photo you sent' }).waitFor({ timeout: 15000 });
      await page.getByText('Photo being checked').waitFor({ state: 'detached', timeout: 30000 });

      // A voice note from the (fake) microphone.
      await page.getByRole('button', { name: /^Add a photo/ }).click();
      await button('Voice note').click();
      await page.getByText(/^Recording 0:0\d/).waitFor({ timeout: 10000 });
      await page.waitForTimeout(1500);
      await button('Send voice note').click();
      await page
        .getByRole('button', { name: /^Play voice note, 0:0[1-3]$/ })
        .waitFor({ timeout: 15000 });

      // A date idea, which Kabir accepts.
      await page.getByRole('button', { name: /^Add a photo/ }).click();
      await button('Date idea').click();
      await page.getByLabel('The idea').fill('Filter coffee and a walk');
      await page.getByLabel('When (optional)').fill('Saturday morning');
      await page.getByLabel('Where, roughly (optional)').fill('Indiranagar');
      await button('Send idea').click();
      await page.getByText('Waiting for an answer').waitFor();
      const withPlan = await call(`/conversations/${conversationId}/messages`, null, token, 'GET');
      const planId = withPlan.messages.find((m) => m.kind === 'date_plan').id;
      await call(`/messages/${planId}/plan/accept`, null, token);
      await page.getByText('You’re both in').waitFor({ timeout: 10000 });
      await snap('conversation-media-plan');

      // Wingman: consent, an idea, edited and sent by Asha.
      await page.getByRole('button', { name: /^Add a photo/ }).click();
      await button('Ask Wingman for ideas').click();
      await button('Turn on Wingman').click();
      await button('Start the conversation').click();
      const idea = page.getByRole('checkbox', { name: /^Hi Kabir/ }).first();
      await idea.waitFor({ timeout: 10000 });
      await snap('wingman');
      await idea.click();
      await page.getByText('Wingman’s idea — make it yours before sending.').waitFor();
      const box = page.getByLabel('Message', { exact: true });
      await box.fill(`${await box.inputValue()} (Asha here)`);
      await button('Send').click();
      await page.getByText(/\(Asha here\)$/).waitFor();

      // Privacy settings for this conversation.
      await button('Conversation settings').click();
      await page.getByRole('switch', { name: 'Read receipts', checked: true }).click();
      await page.getByRole('switch', { name: 'Read receipts', checked: false }).waitFor();
      await snap('conversation-settings');
      // Tap outside the sheet to close it.
      await page.mouse.click(195, 60);
      await page.getByText('Conversation settings', { exact: true }).waitFor({ state: 'detached' });

      // Back in the list; a new message shows a quiet dot, not a count.
      await button('Back').click();
      await page.getByRole('tab', { name: /^Messages/ }).waitFor();
      await page.getByRole('tab', { name: 'Messages' }).click();
      await page.getByText('Your conversations.', { exact: true }).waitFor();
      await kabirSays('See you then!');
      await page.getByRole('tab', { name: 'Messages, something new' }).waitFor({ timeout: 10000 });
      await page.getByRole('link', { name: new RegExp(`^${kabir}, new message`) }).waitFor();
      await snap('messages-list');
      await page.getByRole('tab', { name: 'You' }).click();
    } finally {
      kabirSocket.disconnect();
    }
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

  await step('location from settings: device, then removal', async () => {
    await page.getByRole('link', { name: /^Where you are/ }).click();
    await heading('Where are you?').waitFor();
    // Permission denied: VYRA explains and offers the manual choice instead.
    await context.clearPermissions();
    await button('Use my approximate location').click();
    await page.getByText(/Location permission is off/).waitFor();
    await page.getByLabel('City', { exact: true }).waitFor();
    await snap('settings-location-denied');
    await button('Cancel').click();
    await context.grantPermissions(
      ['clipboard-read', 'clipboard-write', 'geolocation', 'microphone'],
      {
        origin: ORIGIN,
      },
    );
    await button('Use my approximate location').click();
    await page.getByText('From your device, approximate.').waitFor();
    await page.getByText('Bengaluru, Karnataka', { exact: true }).waitFor();
    // The page never shows the precise position it was given.
    const text = await page.locator('body').innerText();
    if (/12\.97|77\.59/.test(text)) throw new Error('precise coordinates shown');
    await snap('settings-location-device');
    await button('Remove my location').click();
    await page.getByText('Not set', { exact: true }).waitFor();
    await button('Back').click();
    await page.getByText(/needs a location/).waitFor();
    await page.getByRole('link', { name: /^Who you see/ }).click();
    await page.getByText(/Distance isn’t used until you set a location/).waitFor();
    await snap('settings-preferences-no-location');
    await button('Back').click();
    await heading('Asha, 28').waitFor();
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
