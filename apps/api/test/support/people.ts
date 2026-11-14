import type {
  DealBreaker,
  PersonaAttributeKey,
  PersonaAttributeValue,
  RelationshipIntent,
} from '@vyra/validation';
import request from 'supertest';
import { registerUser, uniqueEmail, waitForPhoto, type TestApp, type TestUser } from './app.js';
import { makeImage } from './images.js';

let imageSeed = 1000;

export interface SyntheticPerson {
  readonly age?: number;
  readonly gender?: string;
  readonly intents?: RelationshipIntent[];
  readonly minAge?: number;
  readonly maxAge?: number;
  readonly interestedIn?: readonly string[];
  readonly dealBreakers?: DealBreaker[];
  readonly traits?: Partial<Record<PersonaAttributeKey, PersonaAttributeValue>>;
  readonly interests?: string[];
  readonly discoverable?: boolean;
  /** "pending" returns without waiting for moderation to approve the photo. */
  readonly photo?: 'approved' | 'pending';
}

function dobForAge(age: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - age);
  date.setUTCMonth(0, 1); // birthday already passed this year
  if (date.getTime() > Date.now()) date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

/** An active, discoverable person with an approved persona, built through the public API. */
export async function createPerson(
  app: TestApp,
  spec: SyntheticPerson = {},
): Promise<TestUser & { id: string; photoId: string }> {
  const http = () => request(app.getHttpServer());
  const user = await registerUser(app, uniqueEmail(), dobForAge(spec.age ?? 28));
  await http()
    .patch('/v1/me/profile')
    .set(user.auth)
    .send({ displayName: 'Synthetic', gender: spec.gender ?? null })
    .expect(200);
  imageSeed += 1;
  const photo = await http()
    .post('/v1/me/photos')
    .set(user.auth)
    .attach('file', await makeImage(imageSeed), 'p.jpg')
    .expect(201);
  if (spec.photo !== 'pending') await waitForPhoto(app, user, photo.body.id as string);
  await http()
    .put('/v1/me/relationship-intents')
    .set(user.auth)
    .send({
      intents: (spec.intents ?? ['serious']).map((kind) =>
        kind === 'other' ? { kind, customLabel: 'x' } : { kind },
      ),
    })
    .expect(200);
  await http()
    .put('/v1/me/discovery-preferences')
    .set(user.auth)
    .send({
      minAge: spec.minAge ?? 18,
      maxAge: spec.maxAge ?? 99,
      maxDistanceKm: null,
      interestedIn: [...(spec.interestedIn ?? [])],
      showAstrology: false,
      dealBreakers: spec.dealBreakers ?? [],
    })
    .expect(200);
  if (spec.interests?.length) {
    const catalogue = await http().get('/v1/interests').set(user.auth).expect(200);
    const ids = catalogue.body.interests
      .filter((i: { slug: string }) => spec.interests?.includes(i.slug))
      .map((i: { id: string }) => i.id);
    await http().put('/v1/me/interests').set(user.auth).send({ interestIds: ids }).expect(200);
  }
  if (spec.traits && Object.keys(spec.traits).length > 0) {
    await http()
      .patch('/v1/me/persona/draft')
      .set(user.auth)
      .send({ set: spec.traits })
      .expect(200);
    await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(200);
  }
  const done = await http().post('/v1/me/onboarding/complete').set(user.auth).expect(200);
  if (spec.discoverable === false) {
    await http().patch('/v1/me/profile').set(user.auth).send({ isDiscoverable: false }).expect(200);
  }
  return { ...user, id: done.body.id as string, photoId: photo.body.id as string };
}

export const SOCIAL_PLANNER = {
  socialEnergy: 0.75,
  emotionalExpressiveness: 0.75,
  intellectualCuriosity: 0.75,
  adventureOrientation: 1,
  planningStyle: 0.75,
  conflictApproach: 0.75,
  affectionExpression: 0.75,
  communicationStyle: 'expansive',
  lifestylePace: 'outgoing',
  weekendRhythm: 'adventurous',
  values: ['honesty', 'adventure', 'growth'],
} as const satisfies Partial<Record<PersonaAttributeKey, PersonaAttributeValue>>;

export const QUIET_HOMEBODY = {
  socialEnergy: 0,
  emotionalExpressiveness: 0,
  intellectualCuriosity: 0,
  adventureOrientation: 0,
  planningStyle: 0,
  conflictApproach: 0,
  affectionExpression: 0,
  communicationStyle: 'concise',
  lifestylePace: 'homebody',
  weekendRhythm: 'restful',
  values: ['stability', 'calm', 'family'],
} as const satisfies Partial<Record<PersonaAttributeKey, PersonaAttributeValue>>;
