import "dotenv/config";
import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const env = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${env}`, override: true });

export default defineConfig({
    schema: "prisma/public.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: (process.env["PUBLIC_DATABASE_URL"] ?? process.env["DATABASE_URL"])!,
        shadowDatabaseUrl: process.env["PUBLIC_SHADOW_DATABASE_URL"],
    },
});