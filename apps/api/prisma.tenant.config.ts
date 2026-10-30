import "dotenv/config";
import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load environment-specific file first, fallback to .env
const env = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${env}`, override: true });

export default defineConfig({
    schema: "prisma/tenant.prisma",
    migrations: {
      path: "prisma/tenant-migrations",
    },
    datasource: {
      url: process.env["TENANT_DATABASE_URL"],
    },
});