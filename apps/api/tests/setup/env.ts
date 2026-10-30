/*
|--------------------------------------------------------------------------
| TEST SETUP: runs once before every test file (npm test loads it with --import)
|
| 1. If a .env.test file exists, it is read first. That is the place for TEST_DATABASE_URL.
| 2. Every variable that src/config/env.ts requires gets a harmless dummy value, so importing app code
|    never stops the process. Real keys (Paystack, Supabase, JWT...) are overwritten on purpose:
|    a test must never use a real key.
| 3. DATABASE_URL is pointed at the TEST database, or at an address that does not exist when no test
|    database is set. A test can therefore never touch your development database.
|--------------------------------------------------------------------------
*/
import { existsSync } from "fs";

if (existsSync(".env.test")) process.loadEnvFile(".env.test");   // does not override variables already set

const dummy: Record<string, string> = {
    NODE_ENV:                "test",
    BASE_DOMAIN:             "localhost",
    JWT_ACCESS_SECRET:       "test-access-secret-test-access-secret",
    JWT_REFRESH_SECRET:      "test-refresh-secret-test-refresh-secret",
    ENCRYPTION_KEY:          "0".repeat(64),
    SUPABASE_URL:            "http://localhost:54321",
    SUPABASE_SERVICE_KEY:    "test",
    SUPABASE_BUCKET:         "test",
    SUPABASE_PUBLIC_BUCKET:  "test",
    TERMII_API_KEY:          "test",
    TERMII_SENDER_ID:        "test",
    PAYSTACK_SECRET_KEY:     "sk_test_dummy",
    PAYSTACK_PUBLIC_KEY:     "pk_test_dummy",
};

for (const [key, value] of Object.entries(dummy)) process.env[key] = value;

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://nobody:nobody@127.0.0.1:1/none";
