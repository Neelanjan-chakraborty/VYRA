import {
  meSchema,
  placeListSchema,
  publicProfileSchema,
  recommendationListSchema,
  type LocationUpdate,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp, registerUser, type TestApp, type TestUser } from './support/app.js';
import { createPerson } from './support/people.js';

const BENGALURU = 'gn:1277333';
const MUMBAI = 'gn:1275339';
// A precise point in Bengaluru, as a device might report it.
const DEVICE_BENGALURU: LocationUpdate = {
  source: 'device',
  latitude: 12.971_942,
  longitude: 77.593_689,
};
// A point ~12 km from that one (Whitefield direction).
const DEVICE_NEAR: LocationUpdate = { source: 'device', latitude: 12.969_8, longitude: 77.7 };

describe('Location and distance (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  async function recommend(viewer: TestUser) {
    return recommendationListSchema.parse(
      (await http().get('/v1/discovery/recommendations?limit=50').set(viewer.auth).expect(200))
        .body,
    );
  }

  describe('setting a location', () => {
    it('stores a device location only on a ~2 km grid, labelled with the nearest place, and never returns coordinates', async () => {
      const user = await createPerson(app, {});
      const response = await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send(DEVICE_BENGALURU)
        .expect(200);
      expect(response.body).toEqual({
        source: 'DEVICE_APPROXIMATE',
        city: 'Bengaluru',
        region: 'Karnataka',
        area: null,
        countryCode: 'IN',
        distanceAvailable: true,
      });
      const row = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
      expect([row.latitude, row.longitude]).toEqual([12.98, 77.6]);
      const me = JSON.stringify((await http().get('/v1/me').set(user.auth).expect(200)).body);
      expect(me).not.toMatch(/12\.9|77\.5|77\.6|latitude|longitude/);
    });

    it('a device location far from any listed place has no city label but still supports distance', async () => {
      const user = await createPerson(app, {});
      const response = await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send({ source: 'device', latitude: 21.5, longitude: 89.5 })
        .expect(200);
      expect(response.body).toMatchObject({ city: null, distanceAvailable: true });
    });

    it('a manual place uses the place centre; an unlisted city gives no distance', async () => {
      const user = await createPerson(app, {});
      const listed = await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send({ source: 'manual', countryCode: 'IN', placeId: MUMBAI, area: 'Bandra' })
        .expect(200);
      expect(listed.body).toEqual({
        source: 'MANUAL',
        city: 'Mumbai',
        region: 'Maharashtra',
        area: 'Bandra',
        countryCode: 'IN',
        distanceAvailable: true,
      });
      const unlisted = await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send({ source: 'manual', countryCode: 'PT', city: 'Lisbon' })
        .expect(200);
      expect(unlisted.body).toEqual({
        source: 'MANUAL',
        city: 'Lisbon',
        region: null,
        area: null,
        countryCode: 'PT',
        distanceAvailable: false,
      });
      const row = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
      expect(row.latitude).toBeNull();
    });

    it('rejects unknown places, mismatched countries and impossible coordinates', async () => {
      const user = await createPerson(app, {});
      await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send({ source: 'manual', countryCode: 'IN', placeId: 'gn:1' })
        .expect(422);
      await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send({ source: 'manual', countryCode: 'US', placeId: BENGALURU })
        .expect(422);
      await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send({ source: 'device', latitude: 91, longitude: 0 })
        .expect(422);
      await http()
        .put('/v1/me/location')
        .set(user.auth)
        .send({ source: 'gps', latitude: 1, longitude: 1 })
        .expect(422);
    });

    it('removing the location clears every field', async () => {
      const user = await createPerson(app, { location: DEVICE_BENGALURU });
      await http().delete('/v1/me/location').set(user.auth).expect(204);
      const me = meSchema.parse((await http().get('/v1/me').set(user.auth).expect(200)).body);
      expect(me.location).toBeNull();
      const row = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
      expect([row.latitude, row.longitude, row.city, row.locationSource, row.countryCode]).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
    });

    it('needs a profile first', async () => {
      const user = await registerUser(app);
      await http().put('/v1/me/location').set(user.auth).send(DEVICE_BENGALURU).expect(404);
    });

    it('searches places', async () => {
      const user = await registerUser(app);
      const body = placeListSchema.parse(
        (await http().get('/v1/places?country=IN&q=beng').set(user.auth).expect(200)).body,
      );
      expect(body.places[0]).toEqual({
        id: BENGALURU,
        name: 'Bengaluru',
        region: 'Karnataka',
        countryCode: 'IN',
      });
      expect(JSON.stringify(body)).not.toMatch(/latitude|population/);
      await http().get('/v1/places?q=beng').expect(401);
    });
  });

  describe('distance in discovery', () => {
    let near: { id: string };
    let far: { id: string };
    let noLocation: { id: string };
    let unlistedCity: { id: string };

    beforeAll(async () => {
      await prisma.userProfile.updateMany({ data: { isDiscoverable: false } });
      near = await createPerson(app, { location: DEVICE_NEAR });
      far = await createPerson(app, {
        location: { source: 'manual', countryCode: 'IN', placeId: MUMBAI },
      });
      noLocation = await createPerson(app, {});
      unlistedCity = await createPerson(app, {
        location: { source: 'manual', countryCode: 'IN', city: 'Somewhere small' },
      });
    });

    it('with a location and a radius: far people are excluded, people without a location are kept and labelled honestly', async () => {
      const viewer = await createPerson(app, { location: DEVICE_BENGALURU, maxDistanceKm: 25 });
      const list = await recommend(viewer);
      expect(list.distanceFilter).toBe('active');
      const byId = new Map(list.recommendations.map((r) => [r.userId, r]));
      expect(byId.get(near.id)?.distance).toBe('About 10 km away');
      expect(byId.has(far.id)).toBe(false);
      expect(byId.get(noLocation.id)?.distance).toBeNull();
      expect(byId.get(unlistedCity.id)?.distance).toBeNull();
      await http().get(`/v1/people/${far.id}`).set(viewer.auth).expect(404);
    });

    it('a radius without a location is not applied, and says so', async () => {
      const viewer = await createPerson(app, { maxDistanceKm: 10 });
      const list = await recommend(viewer);
      expect(list.distanceFilter).toBe('no_location');
      const ids = list.recommendations.map((r) => r.userId);
      expect(ids).toEqual(
        expect.arrayContaining([near.id, far.id, noLocation.id, unlistedCity.id]),
      );
      expect(list.recommendations.every((r) => r.distance === null)).toBe(true);
    });

    it('a location without a radius shows distances but filters nothing', async () => {
      const viewer = await createPerson(app, { location: DEVICE_BENGALURU });
      const list = await recommend(viewer);
      expect(list.distanceFilter).toBe('off');
      const far1 = list.recommendations.find((r) => r.userId === far.id);
      expect(far1?.distance).toBe('100+ km away');
    });

    it('the candidate’s radius applies too', async () => {
      const strict = await createPerson(app, {
        location: { source: 'manual', countryCode: 'IN', placeId: MUMBAI },
        maxDistanceKm: 10,
      });
      const viewer = await createPerson(app, { location: DEVICE_BENGALURU });
      expect((await recommend(viewer)).recommendations.map((r) => r.userId)).not.toContain(
        strict.id,
      );
    });

    it('profiles show only the band', async () => {
      const viewer = await createPerson(app, { location: DEVICE_BENGALURU, maxDistanceKm: 25 });
      const profile = publicProfileSchema.parse(
        (await http().get(`/v1/people/${near.id}`).set(viewer.auth).expect(200)).body,
      );
      expect(profile.distance).toBe('About 10 km away');
      expect(JSON.stringify(profile)).not.toMatch(/latitude|longitude|12\.9|77\./);
    });

    it('removing the viewer’s location turns the filter off at once', async () => {
      const viewer = await createPerson(app, { location: DEVICE_BENGALURU, maxDistanceKm: 25 });
      expect((await recommend(viewer)).recommendations.map((r) => r.userId)).not.toContain(far.id);
      await http().delete('/v1/me/location').set(viewer.auth).expect(204);
      const list = await recommend(viewer);
      expect(list.distanceFilter).toBe('no_location');
      expect(list.recommendations.map((r) => r.userId)).toContain(far.id);
    });
  });
});
