import { mock } from 'bun:test';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { DRIZZLE_PATH } from '../helpers/paths';
import { seedDatabase } from './seed';

/**
 * This file is preloaded FIRST (via bunfig.toml) to mock the db module
 * before any other code imports it.
 *
 * Architecture:
 * 1. mock-db.ts (this file) - Creates initial db for module imports
 * 2. setup.ts - beforeEach truncates tables and re-seeds for each test
 *
 * CRITICAL: We use a Proxy to ensure all database access goes through
 * the getter, so that setTestDb() properly updates the active database.
 */

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL or DATABASE_URL must be set for running tests'
  );
}

const client = postgres(testDatabaseUrl);
let tdb: PostgresJsDatabase = drizzle({ client });

const initDb = async () => {
  await migrate(tdb, { migrationsFolder: DRIZZLE_PATH });
  await seedDatabase(tdb);

  return tdb;
};

await initDb();

// create a Proxy that forwards all operations to the current tdb
const dbProxy = new Proxy({} as PostgresJsDatabase, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tdb as any)[prop];
  },
  set(_target, prop, value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tdb as any)[prop] = value;
    return true;
  }
});

mock.module('../db/index', () => ({
  db: dbProxy,
  loadDb: async () => {} // No-op in tests
}));

const setTestDb = (newDb: PostgresJsDatabase) => {
  tdb = newDb;
};

const getTestDb = () => tdb;

export { client, dbProxy, DRIZZLE_PATH, getTestDb, setTestDb };
