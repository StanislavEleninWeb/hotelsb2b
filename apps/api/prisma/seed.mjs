// Dev seed: two properties with room types, rooms, rate plans, amenities, plus a
// staff admin, a property-scoped front-desk user, and a guest account. Idempotent:
// the two demo properties are recreated from scratch each run (dev only).
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPw(pw) {
  const salt = randomBytes(16);
  const derived = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const AMENITIES = [
  { code: 'wifi', name: 'Free Wi-Fi', category: 'general' },
  { code: 'parking', name: 'Parking', category: 'general' },
  { code: 'pool', name: 'Swimming pool', category: 'wellness' },
  { code: 'breakfast', name: 'Breakfast', category: 'general' },
  { code: 'wheelchair_access', name: 'Wheelchair accessible', category: 'accessibility' },
];

async function amenityIds() {
  const map = {};
  for (const a of AMENITIES) {
    const row = await prisma.amenity.upsert({
      where: { code: a.code },
      update: { name: a.name, category: a.category },
      create: a,
    });
    map[a.code] = row.id;
  }
  return map;
}

async function seedProperty(def, amenities) {
  await prisma.property.deleteMany({ where: { slug: def.slug } });
  const property = await prisma.property.create({
    data: {
      slug: def.slug,
      name: def.name,
      description: def.description,
      city: def.city,
      countryCode: def.countryCode,
      currency: 'EUR',
      timezone: def.timezone,
      images: { create: def.images.map((url, i) => ({ url, sortOrder: i })) },
      amenities: { create: def.amenities.map((code) => ({ amenityId: amenities[code] })) },
    },
  });

  for (const rt of def.roomTypes) {
    const roomType = await prisma.roomType.create({
      data: {
        propertyId: property.id,
        slug: rt.slug,
        name: rt.name,
        description: rt.description,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        maxOccupancy: rt.maxAdults + rt.maxChildren,
        bedConfig: rt.bedConfig,
        images: { create: rt.images.map((url, i) => ({ url, sortOrder: i })) },
        ratePlans: {
          create: [
            {
              propertyId: property.id,
              name: 'Flexible',
              cancellationPolicy: 'REFUNDABLE',
              refundableUntilHrs: 48,
              paymentType: 'FULL',
              includesBreakfast: true,
              minStayNights: 1,
              basePriceMinor: rt.priceMinor + 2000,
              currency: 'EUR',
            },
            {
              propertyId: property.id,
              name: 'Saver (non-refundable)',
              cancellationPolicy: 'NON_REFUNDABLE',
              paymentType: 'FULL',
              includesBreakfast: false,
              minStayNights: 1,
              basePriceMinor: rt.priceMinor,
              currency: 'EUR',
            },
          ],
        },
      },
    });
    // Physical rooms
    for (let i = 0; i < rt.roomCount; i++) {
      await prisma.room.create({
        data: {
          propertyId: property.id,
          roomTypeId: roomType.id,
          number: `${rt.floor}${(i + 1).toString().padStart(2, '0')}`,
          floor: rt.floor,
        },
      });
    }
  }
  return property;
}

async function main() {
  const amenities = await amenityIds();

  const grand = await seedProperty(
    {
      slug: 'grand-harbor',
      name: 'The Grand Harbor Hotel',
      description: 'A waterfront hotel with harbor views, pool, and a renowned breakfast.',
      city: 'Lisbon',
      countryCode: 'PT',
      timezone: 'Europe/Lisbon',
      images: ['https://example.com/grand-1.jpg', 'https://example.com/grand-2.jpg'],
      amenities: ['wifi', 'parking', 'pool', 'breakfast', 'wheelchair_access'],
      roomTypes: [
        {
          slug: 'standard-double',
          name: 'Standard Double',
          description: 'Cozy double room with city view.',
          maxAdults: 2,
          maxChildren: 1,
          bedConfig: '1 queen',
          priceMinor: 9000,
          roomCount: 5,
          floor: 1,
          images: ['https://example.com/std-1.jpg'],
        },
        {
          slug: 'deluxe-harbor',
          name: 'Deluxe Harbor View',
          description: 'Spacious room with a private balcony over the harbor.',
          maxAdults: 3,
          maxChildren: 1,
          bedConfig: '1 king + sofa',
          priceMinor: 15000,
          roomCount: 3,
          floor: 3,
          images: ['https://example.com/dlx-1.jpg'],
        },
      ],
    },
    amenities,
  );

  await seedProperty(
    {
      slug: 'alpine-lodge',
      name: 'Alpine Lodge & Spa',
      description: 'Mountain retreat with spa, ski access, and fireside lounges.',
      city: 'Innsbruck',
      countryCode: 'AT',
      timezone: 'Europe/Vienna',
      images: ['https://example.com/alpine-1.jpg'],
      amenities: ['wifi', 'parking', 'breakfast'],
      roomTypes: [
        {
          slug: 'lodge-twin',
          name: 'Lodge Twin',
          description: 'Twin room with mountain views.',
          maxAdults: 2,
          maxChildren: 0,
          bedConfig: '2 twin',
          priceMinor: 11000,
          roomCount: 4,
          floor: 2,
          images: ['https://example.com/twin-1.jpg'],
        },
      ],
    },
    amenities,
  );

  // Staff: admin (global) + front-desk scoped to grand-harbor.
  await prisma.user.upsert({
    where: { email: 'admin@hotel.test' },
    update: {},
    create: {
      email: 'admin@hotel.test',
      passwordHash: hashPw('password123'),
      firstName: 'Ada',
      lastName: 'Admin',
      role: 'ADMIN',
    },
  });
  const frontDesk = await prisma.user.upsert({
    where: { email: 'frontdesk@hotel.test' },
    update: {},
    create: {
      email: 'frontdesk@hotel.test',
      passwordHash: hashPw('password123'),
      firstName: 'Fred',
      lastName: 'Desk',
      role: 'FRONT_DESK',
    },
  });
  await prisma.staffPropertyAccess.upsert({
    where: { userId_propertyId: { userId: frontDesk.id, propertyId: grand.id } },
    update: {},
    create: { userId: frontDesk.id, propertyId: grand.id },
  });

  // Guest account (delete any prior account row to keep the partial-unique index happy).
  await prisma.guest.deleteMany({ where: { email: 'guest@hotel.test', isAccount: true } });
  await prisma.guest.create({
    data: {
      email: 'guest@hotel.test',
      passwordHash: hashPw('password123'),
      firstName: 'Gina',
      lastName: 'Guest',
      isAccount: true,
    },
  });

  console.log('Seed complete: 2 properties, staff (admin@/frontdesk@), guest@hotel.test — pw password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
