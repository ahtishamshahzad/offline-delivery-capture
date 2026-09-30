import type { SQLiteDatabase } from 'expo-sqlite';

import { CREATE_APP_SETTINGS_TABLE, CREATE_DELIVERIES_TABLE } from './schema';

/**
 * Ordered migrations. Index + 1 is the schema version stored in
 * `PRAGMA user_version`. Only ever append — never edit a shipped migration.
 */
const MIGRATIONS: readonly string[] = [CREATE_DELIVERIES_TABLE + CREATE_APP_SETTINGS_TABLE];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (let version = currentVersion; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      // PRAGMA cannot be parameterized; `version + 1` is a trusted integer.
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
