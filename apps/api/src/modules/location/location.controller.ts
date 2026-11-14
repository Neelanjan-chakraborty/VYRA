import { Body, Controller, Delete, Get, HttpCode, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  locationUpdateSchema,
  type LocationUpdate,
  type LocationView,
  type PlaceView,
} from '@vyra/validation';
import { searchPlaces } from '@vyra/validation/places';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { LocationService } from './location.service.js';

const placeQuery = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .default('IN'),
  q: z.string().trim().max(60).default(''),
});

@ApiTags('location')
@ApiBearerAuth()
@Controller()
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Put('me/location')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Set an approximate device location or a manually chosen place' })
  set(
    @CurrentUser() user: AuthContext,
    @Body({ schema: locationUpdateSchema }) body: LocationUpdate,
    @Req() request: Request,
  ): Promise<LocationView> {
    return this.location.set(user.userId, body, getRequestId(request));
  }

  @Delete('me/location')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove location entirely; distance filtering stops' })
  async clear(@CurrentUser() user: AuthContext, @Req() request: Request): Promise<void> {
    await this.location.clear(user.userId, getRequestId(request));
  }

  @Get('places')
  @ApiOperation({ summary: 'Search places for manual selection (GeoNames, CC BY 4.0)' })
  places(@Query({ schema: placeQuery }) query: z.infer<typeof placeQuery>): {
    places: PlaceView[];
  } {
    return {
      places: searchPlaces(query.q, query.country).map(({ id, name, region, countryCode }) => ({
        id,
        name,
        region,
        countryCode,
      })),
    };
  }
}
