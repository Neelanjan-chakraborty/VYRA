import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { type LocationUpdate, type LocationView, roundToGrid } from '@vyra/validation';
import { nearestPlace, placeById } from '@vyra/validation/places';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const CLEARED = {
  latitude: null,
  longitude: null,
  locationSource: null,
  placeId: null,
  region: null,
  area: null,
  city: null,
  countryCode: null,
} as const;

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Stores the least precise location that still supports distance: device
   * positions are snapped to a ~2 km grid and labelled with the nearest
   * listed place; manual choices use the listed place's centre, or no
   * coordinates at all for a city that isn't listed. Nothing is invented.
   */
  async set(userId: string, update: LocationUpdate, requestId: string): Promise<LocationView> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Create your profile first.');

    let data;
    if (update.source === 'device') {
      const latitude = roundToGrid(update.latitude);
      const longitude = roundToGrid(update.longitude);
      const place = nearestPlace({ latitude, longitude });
      data = {
        ...CLEARED,
        locationSource: 'DEVICE_APPROXIMATE' as const,
        latitude,
        longitude,
        city: place?.name ?? null,
        region: place?.region ?? null,
        countryCode: place?.countryCode ?? null,
      };
    } else if (update.placeId) {
      const place = placeById(update.placeId);
      if (!place || place.countryCode !== update.countryCode) {
        throw new UnprocessableEntityException({
          message: 'Choose a place from the list.',
          details: [{ path: 'placeId', message: 'Unknown place' }],
        });
      }
      data = {
        ...CLEARED,
        locationSource: 'MANUAL' as const,
        placeId: place.id,
        latitude: roundToGrid(place.latitude),
        longitude: roundToGrid(place.longitude),
        city: place.name,
        region: place.region,
        countryCode: place.countryCode,
        area: update.area ?? null,
      };
    } else {
      // An unlisted city is kept as a label: distance stays unavailable rather than guessed.
      data = {
        ...CLEARED,
        locationSource: 'MANUAL' as const,
        city: update.city ?? null,
        countryCode: update.countryCode,
        area: update.area ?? null,
      };
    }
    await this.prisma.userProfile.update({ where: { userId }, data });
    await this.audit.record({
      action: 'location.set',
      actorId: userId,
      metadata: { source: data.locationSource, distance: data.latitude !== null },
      requestId,
    });
    return (await this.view(userId)) as LocationView;
  }

  /** Revocation: every location field is removed. */
  async clear(userId: string, requestId: string): Promise<void> {
    await this.prisma.userProfile.updateMany({ where: { userId }, data: CLEARED });
    await this.audit.record({ action: 'location.cleared', actorId: userId, requestId });
  }

  async view(userId: string): Promise<LocationView | null> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile?.locationSource) return null;
    return {
      source: profile.locationSource,
      city: profile.city,
      region: profile.region,
      area: profile.area,
      countryCode: profile.countryCode,
      distanceAvailable: profile.latitude !== null && profile.longitude !== null,
    };
  }
}
