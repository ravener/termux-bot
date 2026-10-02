import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable('users', {
    id: text().primaryKey(),
    points: int().notNull().default(0)
});
