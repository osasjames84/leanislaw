import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // We are forcing the process to read the environment variable
    url: process.env.DATABASE_URL,
  },
});