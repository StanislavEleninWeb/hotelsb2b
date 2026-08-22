import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AvailabilityService, RoomTypeAvailability } from './availability.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  // Public, unauthenticated search — the most-scraped endpoint, so a tighter
  // rate limit than the global default (§5.5).
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  search(@Query() query: SearchAvailabilityDto): Promise<RoomTypeAvailability[]> {
    return this.availability.search({
      propertyId: query.propertyId,
      checkIn: new Date(`${query.checkIn.slice(0, 10)}T00:00:00.000Z`),
      checkOut: new Date(`${query.checkOut.slice(0, 10)}T00:00:00.000Z`),
      adults: query.adults,
      children: query.children,
    });
  }
}
