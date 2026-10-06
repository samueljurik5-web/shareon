process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://shareon:shareon@localhost:5432/shareon_test?schema=public';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-0123';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.UPLOAD_DIR = 'uploads-test';
