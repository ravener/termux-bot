import { drizzle } from 'drizzle-orm/better-sqlite3';

const { DB_FILE_NAME } = process.env;
if (!DB_FILE_NAME) {
    console.error("DB_FILE_NAME not defined, cannot initialize database.");
    process.exit(1);
}

export const db = drizzle(DB_FILE_NAME);
