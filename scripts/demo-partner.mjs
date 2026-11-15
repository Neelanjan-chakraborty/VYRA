#!/usr/bin/env node
// A fake dating partner for testing the real flows end to end, driven entirely
// through the public API (the same calls the app makes). Needs an API running
// with OTP_DELIVERY=dev, which returns the sign-in code in the response.
//
//   node scripts/demo-partner.mjs seed   --api https://host --target username --lat 23.2 --lon 72.6
//   node scripts/demo-partner.mjs say    --api https://host "Hi! How was your day?"
//   node scripts/demo-partner.mjs remove --api https://host
//
// Everything here is invented. The photos are abstract avatars, not people.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp');

const EMAIL = 'meera.demo@example.com';
const TERMS = '2026-11';

const args = process.argv.slice(2);
const command = args.shift();
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const api = (flag('api') ?? 'http://localhost:4000').replace(/\/$/, '');
const target = flag('target');
const lat = Number(flag('lat'));
const lon = Number(flag('lon'));

async function call(path, { method = 'GET', body, token, form } = {}) {
  const response = await fetch(`${api}/v1${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { status: response.status, json };
}
async function must(path, options, ok = [200, 201, 202, 204]) {
  const result = await call(path, options);
  if (!ok.includes(result.status)) {
    throw new Error(
      `${options?.method ?? 'GET'} ${path} -> ${result.status} ${JSON.stringify(result.json)}`,
    );
  }
  return result.json;
}

const SESSION_FILE = join(homedir(), '.vyra-demo-partner.json');
const readSessions = () =>
  existsSync(SESSION_FILE) ? JSON.parse(readFileSync(SESSION_FILE, 'utf8')) : {};
/** Keeps the refresh token, so repeated commands don't each ask for a new sign-in code. */
function keepSession(tokens) {
  writeFileSync(SESSION_FILE, JSON.stringify({ ...readSessions(), [api]: tokens.refreshToken }), {
    mode: 0o600,
  });
  chmodSync(SESSION_FILE, 0o600);
}

/** Signs in (or up) and returns an access token. Reuses the saved session when it can. */
async function signIn() {
  const saved = readSessions()[api];
  if (saved) {
    const refreshed = await call('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: saved },
    });
    if (refreshed.status === 200) {
      keepSession(refreshed.json);
      return refreshed.json.accessToken;
    }
  }
  const challenge = await must('/auth/otp/request', {
    method: 'POST',
    body: { channel: 'email', destination: EMAIL },
  });
  const verified = await must('/auth/otp/verify', {
    method: 'POST',
    body: {
      channel: 'email',
      destination: EMAIL,
      challengeId: challenge.challengeId,
      code: challenge.devCode,
    },
  });
  if (verified.status === 'authenticated') {
    keepSession(verified.tokens);
    return verified.tokens.accessToken;
  }
  const registered = await must('/auth/register', {
    method: 'POST',
    body: {
      registrationToken: verified.registrationToken,
      dateOfBirth: new Date(Date.UTC(new Date().getUTCFullYear() - 26, 2, 14))
        .toISOString()
        .slice(0, 10),
      acceptedTermsVersion: TERMS,
      acceptedPrivacyVersion: TERMS,
    },
  });
  keepSession(registered);
  return registered.accessToken;
}

/** An abstract portrait: head and shoulders on a soft gradient. No real person. */
function avatar(top, bottom, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
    <rect width="1200" height="1500" fill="url(#g)"/>
    <ellipse cx="600" cy="1500" rx="520" ry="560" fill="${body}"/>
    <rect x="540" y="760" width="120" height="200" rx="50" fill="#d9b49b"/>
    <ellipse cx="600" cy="600" rx="190" ry="235" fill="#e6c3aa"/>
    <path d="M405 560 C 400 330 560 300 640 320 C 760 340 800 450 795 580 C 740 470 600 440 405 560Z" fill="#2b1d1a"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

async function waitForPhoto(token, id) {
  for (let i = 0; i < 120; i += 1) {
    const me = await must('/me', { token });
    const photo = me.photos.find((p) => p.id === id);
    if (photo && photo.status !== 'PENDING') return photo.status;
    await new Promise((r) => setTimeout(r, 500));
  }
  return 'PENDING';
}

async function seed() {
  if (!target || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('seed needs --target <username> --lat <n> --lon <n>');
  }
  const token = await signIn();
  const me = await must('/me', { token });
  if (me.status === 'ACTIVE') {
    console.log('Meera already exists; skipping profile setup.');
  } else {
    await must('/me/profile', {
      method: 'PATCH',
      token,
      body: {
        displayName: 'Meera',
        bio: 'Product designer. I bake slightly burnt things, read too much fiction, and will absolutely take the long way home.',
        occupation: 'Product designer',
        genderIdentity: 'WOMAN',
        genderVisible: true,
      },
    });
    const colours = [
      ['#f4d8c6', '#c98f86', '#3f4a63'],
      ['#cfe0e8', '#8aa7b8', '#6b3f4a'],
      ['#f3e3b8', '#d1a461', '#2f5a4e'],
    ];
    const ids = [];
    for (const [top, bottom, body] of colours) {
      const form = new FormData();
      form.append(
        'file',
        new Blob([await avatar(top, bottom, body)], { type: 'image/jpeg' }),
        'photo.jpg',
      );
      const photo = await must('/me/photos', { method: 'POST', token, form });
      ids.push(photo.id);
    }
    const states = await Promise.all(ids.map((id) => waitForPhoto(token, id)));
    console.log('Photo moderation:', states.join(', '));

    await must('/me/relationship-intents', {
      method: 'PUT',
      token,
      body: { intents: [{ kind: 'serious' }] },
    });
    await must('/me/discovery-preferences', {
      method: 'PUT',
      token,
      body: {
        minAge: 22,
        maxAge: 33,
        maxDistanceKm: null,
        showGenders: ['MAN'],
        includeUnlistedGenders: true,
        showAstrology: false,
        criteria: [],
      },
    });
    const catalogue = await must('/interests', { token });
    const wanted = [
      'literary-fiction',
      'baking',
      'arthouse-film',
      'road-trips',
      'illustration',
      'electronic',
    ];
    await must('/me/interests', {
      method: 'PUT',
      token,
      body: {
        interestIds: catalogue.interests.filter((i) => wanted.includes(i.slug)).map((i) => i.id),
      },
    });
    // A little way from the target, well inside any reasonable distance limit.
    await must('/me/location', {
      method: 'PUT',
      token,
      body: { source: 'device', latitude: lat + 0.02, longitude: lon + 0.02 },
    });
    await must('/me/persona/draft', {
      method: 'PATCH',
      token,
      body: {
        set: {
          socialEnergy: 0.6,
          emotionalExpressiveness: 0.7,
          intellectualCuriosity: 0.85,
          adventureOrientation: 0.55,
          planningStyle: 0.7,
          conflictApproach: 0.65,
          affectionExpression: 0.7,
          communicationStyle: 'expansive',
          lifestylePace: 'balanced',
          weekendRhythm: 'restful',
          values: ['family', 'loyalty', 'calm', 'curiosity', 'creativity'],
        },
      },
    });
    await must('/me/persona/draft/approve', { method: 'POST', token });
    await must('/me/onboarding/complete', { method: 'POST', token });
    await must(
      '/me/username',
      { method: 'PUT', token, body: { username: 'meera.designs' } },
      [200, 409],
    );
    console.log('Created Meera (@meera.designs).');
  }

  const found = await call(`/people/by-username/${encodeURIComponent(target)}`, { token });
  if (found.status !== 200) {
    console.log(
      `Meera can't see @${target} (${found.status}): they and she don't pass each other's filters.`,
    );
    return;
  }
  const sent = await call('/connections/requests', {
    method: 'POST',
    token,
    body: { recipientId: found.json.userId, note: 'Your reading list made me smile. Hi.' },
  });
  console.log(
    sent.status === 201
      ? `Request sent to @${target}. Accept it in Connections to start chatting.`
      : `Request not sent (${sent.status}): ${JSON.stringify(sent.json)}`,
  );
}

async function say() {
  const text = args.join(' ').trim();
  if (!text) throw new Error('say needs the message text');
  const token = await signIn();
  const { conversations } = await must('/conversations', { token });
  const open = conversations.find((c) => !c.readOnly);
  if (!open) throw new Error('No open conversation yet. Accept the request in the app first.');
  await must(`/conversations/${open.id}/messages`, {
    method: 'POST',
    token,
    body: { kind: 'text', clientId: randomUUID(), body: text },
  });
  console.log('Sent.');
}

async function remove() {
  const token = await signIn();
  await must('/me', { method: 'DELETE', token, body: { confirm: 'DELETE' } });
  const sessions = readSessions();
  delete sessions[api];
  writeFileSync(SESSION_FILE, JSON.stringify(sessions), { mode: 0o600 });
  console.log('Meera deleted.');
}

const commands = { seed, say, remove };
if (!commands[command]) {
  console.error('Usage: demo-partner.mjs seed|say|remove --api <url> ...');
  process.exit(2);
}
commands[command]().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
