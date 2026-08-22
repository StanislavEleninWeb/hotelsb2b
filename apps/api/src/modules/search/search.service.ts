import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const SEARCH_SERVICE = Symbol('SEARCH_SERVICE');

export interface PropertySearchResult {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  currency: string;
  description: string | null;
}

// Swap this implementation for OpenSearch later behind the same interface — a new
// class bound to SEARCH_SERVICE, not a rewrite of the callers (Plan/03 Phase 7).
export interface SearchService {
  searchProperties(destination: string | undefined, limit?: number): Promise<PropertySearchResult[]>;
}

@Injectable()
export class PostgresSearchService implements SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchProperties(destination: string | undefined, limit = 20): Promise<PropertySearchResult[]> {
    const q = destination?.trim();
    if (!q) {
      return this.prisma.property.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          countryCode: true,
          currency: true,
          description: true,
        },
      });
    }

    // FTS (websearch_to_tsquery) OR trigram similarity for typo tolerance, ranked
    // by similarity. Parameterized — never interpolated (invariant #2).
    const like = `%${q}%`;
    return this.prisma.$queryRaw<PropertySearchResult[]>`
      SELECT id, slug, name, city, "countryCode", currency, description
      FROM "Property"
      WHERE active = true AND (
        to_tsvector(
          'english',
          coalesce(name,'') || ' ' || coalesce(city,'') || ' ' || coalesce(description,'')
        ) @@ websearch_to_tsquery('english', ${q})
        OR name ILIKE ${like}
        OR city ILIKE ${like}
        OR similarity(name, ${q}) > 0.2
        OR similarity(coalesce(city,''), ${q}) > 0.2
      )
      ORDER BY GREATEST(similarity(name, ${q}), similarity(coalesce(city,''), ${q})) DESC, name ASC
      LIMIT ${Prisma.raw(String(Math.min(Math.max(limit, 1), 50)))}
    `;
  }
}
