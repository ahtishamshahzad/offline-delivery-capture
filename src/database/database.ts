import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

const DATABASE_NAME = 'deliveries.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // WAL: a crash mid-write leaves each row in its old or new state, never torn.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await runMigrations(db);
  return db;
}

/** Single shared connection, opened and migrated once. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((error: unknown) => {
      dbPromise = null; // allow a later retry instead of caching the failure
      throw error;
    });
  }
  return dbPromise;
}
