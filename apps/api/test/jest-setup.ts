// Default the DB connection for tests to the local docker Postgres unless the
// environment already provides one (CI supplies its own DATABASE_URL).
process.env.DATABASE_URL ||=
  'postgresql://hotel:hotel_dev_password@localhost:5432/hotel';
process.env.REDIS_URL ||= 'redis://:redis_dev_password@localhost:6379';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret';
process.env.NODE_ENV ||= 'test';
