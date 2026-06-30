import "dotenv/config";
import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load environment-specific file first, fallback to .env
const env = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${env}`, override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});