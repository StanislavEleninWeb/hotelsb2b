import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AvailabilityService, RoomTypeAvailability } from '../availability/availability.service';
import { PropertySearchResult, SEARCH_SERVICE, SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';

interface SearchResultRow {
  property: PropertySearchResult;
  availability: RoomTypeAvailability[];
}

// Public, unauthenticated search (SD-01/SD-02). Returns matching properties WITH
// availability inline (one call per property, server-side) so the web client
// doesn't fan out N+1. Tight rate limit like /availability (§5.5).
@Controller('search')
export class SearchController {
  constructor(
    @Inject(SEARCH_SERVICE) private readonly search: SearchService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async run(@Query() dto: SearchDto): Promise<SearchResultRow[]> {
    const properties = await this.search.searchProperties(dto.destination);

    const datesValid =
      !!dto.checkIn && !!dto.checkOut && dto.checkOut.slice(0, 10) > dto.checkIn.slice(0, 10);
    if (!datesValid) return properties.map((property) => ({ property, availability: [] }));

    const checkIn = new Date(`${dto.checkIn!.slice(0, 10)}T00:00:00.000Z`);
    const checkOut = new Date(`${dto.checkOut!.slice(0, 10)}T00:00:00.000Z`);

    return Promise.all(
      properties.map(async (property) => ({
        property,
        availability: await this.availability.search({
          propertyId: property.id,
          checkIn,
          checkOut,
          adults: dto.adults,
          children: dto.children,
        }),
      })),
    );
  }
}
