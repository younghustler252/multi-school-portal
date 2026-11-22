/**
 * Destructive reset for the dedicated local CORE test database only.
 *
 * Required in .env.development:
 *   ALLOW_TEST_DATABASE_RESET=true
 *   TEST_DATABASE_RESET_CONFIRM=school_portal
 *   TEST_DATABASE_HOST_ALLOWLIST=172.18.0.2
 *
 * This drops and recreates the database. It refuses every database name other
 * than school_portal, production mode, and hosts not explicitly allowlisted.
 * Back up anything needed before running.
 */
import { Client } from "pg";
import { env } from "../src/config/env";

const EXPECTED_DATABASE = "school_portal";

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to reset a database in production mode.");
  }
  if (process.env.ALLOW_TEST_DATABASE_RESET !== "true") {
    throw new Error("Refusing reset. Set ALLOW_TEST_DATABASE_RESET=true in .env.development.");
  }
  if (process.env.TEST_DATABASE_RESET_CONFIRM !== EXPECTED_DATABASE) {
    throw new Error(`Refusing reset. Set TEST_DATABASE_RESET_CONFIRM=${EXPECTED_DATABASE} to confirm the exact target.`);
  }

  const target = new URL(env.DATABASE_URL);
  const allowedHosts = new Set([
    "localhost", "127.0.0.1", "::1",
    ...(process.env.TEST_DATABASE_HOST_ALLOWLIST ?? "")
      .split(",").map((host) => host.trim()).filter(Boolean),
  ]);
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  const databaseUser = decodeURIComponent(target.username);

  if (!allowedHosts.has(target.hostname)) {
    throw new Error(`Refusing reset against non-allowlisted host: ${target.hostname}`);
  }
  if (databaseName !== EXPECTED_DATABASE) {
    throw new Error(`Refusing reset of "${databaseName}". Only "${EXPECTED_DATABASE}" is permitted.`);
  }
  if (!databaseUser) throw new Error("DATABASE_URL must include an explicit database user.");

  const maintenanceUrl = new URL(target);
  maintenanceUrl.pathname = "/postgres";
  maintenanceUrl.searchParams.delete("schema");

  console.log("DESTRUCTIVE TEST DATABASE RESET");
  console.log(`Target: ${databaseUser}@${target.hostname}:${target.port || "5432"}/${databaseName}`);
  console.log("Dropping and recreating the database; all records and schemas inside it will be lost.");

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [EXPECTED_DATABASE],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(EXPECTED_DATABASE)}`);
    await client.query(`CREATE DATABASE ${quoteIdentifier(EXPECTED_DATABASE)} OWNER ${quoteIdentifier(databaseUser)}`);
  } finally {
    await client.end();
  }

  console.log("✓ Test database recreated. Apply public Prisma migrations before starting the API.");
}

main().catch((error) => {
  console.error("\n✗ Test database reset failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
