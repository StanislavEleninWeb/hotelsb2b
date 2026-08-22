import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { SearchController } from './search.controller';
import { PostgresSearchService, SEARCH_SERVICE } from './search.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [SearchController],
  providers: [{ provide: SEARCH_SERVICE, useClass: PostgresSearchService }],
})
export class SearchModule {}
