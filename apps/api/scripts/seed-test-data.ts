/**
 * Local-only CORE test-data bootstrap.
 *
 * Run from apps/api:
 *   ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true \
 *   TEST_PLATFORM_ADMIN_EMAIL=platform.admin@example.test \
 *   TEST_PLATFORM_ADMIN_PASSWORD='ChangeThis!234' \
 *   PLATFORM_BASE_URL=http://admin.localhost:4000 \
 *   npx tsx scripts/seed-test-data.ts
 *
 * Optional:
 *   REGISTER_TEST_PASSWORD='RegisterThis!234' npx tsx scripts/seed-test-data.ts
 *
 * Creates a local platform admin, creates one platform-managed test school,
 * and optionally creates one self-registration test school. Never deletes data.
 * Do not run against production.
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma, disconnectPrisma } from "../src/infrastructure/database/prisma/prisma.client";

const API_PREFIX = "/api/v1";
const ROLE_NAME = "Local Test Platform Admin";
const ROLE_DESCRIPTION = "Local-only test role. Grants all platform permissions.";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertLocalOnly(): URL {
  if (process.env.ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Refusing to run. Set ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true to confirm this is a local test run.");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production.");

  const db = new URL(required("DATABASE_URL"));
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(db.hostname)) {
    throw new Error(`Refusing to bootstrap a platform admin on non-local database host: ${db.hostname}`);
  }

  const api = new URL(process.env.PLATFORM_BASE_URL || "http://admin.localhost:4000");
  const localApiHost = api.hostname === "localhost" || api.hostname === "127.0.0.1" ||
    api.hostname === "::1" || api.hostname.endsWith(".localhost");
  if (!localApiHost) throw new Error(`Refusing to call non-local API host: ${api.hostname}`);
  return api;
}

function unwrapData(payload: any): any {
  let value = payload;
  for (let i = 0; i < 3; i++) {
    if (value && typeof value === "object" && "data" in value) value = value.data;
    else break;
  }
  return value;
}

async function requestJson(base: URL, path: string, options: {
  method?: string; token?: string; body?: unknown;
} = {}): Promise<any> {
  const response = await fetch(new URL(`${API_PREFIX}${path}`, base), {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const raw = await response.text();
  let payload: any;
  try { payload = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error(`${options.method ?? "GET"} ${path}: non-JSON response (${response.status}): ${raw.slice(0, 500)}`); }
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function bootstrapPlatformAdmin(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash, firstName: "Local", lastName: "Platform Admin",
      isActive: true, isEmailVerified: true, emailVerifiedAt: new Date(),
      mustChangePassword: false, failedLoginCount: 0, lockedUntil: null,
    },
    create: {
      email, passwordHash, firstName: "Local", lastName: "Platform Admin",
      isActive: true, isEmailVerified: true, emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  const role = await prisma.platformRole.upsert({
    where: { name: ROLE_NAME },
    update: { description: ROLE_DESCRIPTION, kind: "CUSTOM", grantsAll: true, isActive: true },
    create: { name: ROLE_NAME, description: ROLE_DESCRIPTION, kind: "CUSTOM", grantsAll: true, isActive: true },
  });
  const member = await prisma.platformMember.upsert({
    where: { userId: user.id },
    update: { status: "active" },
    create: { userId: user.id, status: "active" },
  });
  await prisma.platformMemberRole.upsert({
    where: { memberId_roleId: { memberId: member.id, roleId: role.id } },
    update: {},
    create: { memberId: member.id, roleId: role.id },
  });
  return user.id;
}

async function main() {
  const apiBase = assertLocalOnly();
  const platformEmail = required("TEST_PLATFORM_ADMIN_EMAIL").toLowerCase();
  const platformPassword = required("TEST_PLATFORM_ADMIN_PASSWORD");
  const suffix = uniqueSuffix();

  console.log("CORE local test-data bootstrap");
  console.log(`API: ${apiBase.origin}`);
  console.log("Database host: local; no records will be deleted.");

  const userId = await bootstrapPlatformAdmin(platformEmail, platformPassword);
  console.log(`✓ Local platform admin ready: ${platformEmail} (${userId})`);

  const loginPayload = await requestJson(apiBase, "/auth/login", {
    method: "POST", body: { email: platformEmail, password: platformPassword },
  });
  const loginData = unwrapData(loginPayload);
  const accessToken = loginData?.tokens?.accessToken ?? loginData?.accessToken;
  if (!accessToken) {
    throw new Error("Login returned no access token. Ensure PLATFORM_BASE_URL uses the configured admin host (for example admin.localhost), not a school host.");
  }
  console.log("✓ Platform login successful.");

  const platformSchool = await requestJson(apiBase, "/platform/schools", {
    method: "POST",
    token: accessToken,
    body: {
      name: `CORE Test School ${suffix}`,
      subdomain: `core-test-${suffix}`.slice(0, 50),
      email: `school-${suffix}@example.test`,
      phone: "+2348000000000",
      schoolCategory: "primary_secondary",
      schoolOwnership: "private",
      admin: {
        firstName: "Test", lastName: "School Admin",
        email: `school-admin-${suffix}@example.test`,
        phone: "+2348000000001",
      },
    },
  });
  const schoolData = unwrapData(platformSchool);
  console.log("✓ Platform-created test school submitted.");
  console.log(`  Subdomain: core-test-${suffix}`);
  if (schoolData?.id) console.log(`  School ID: ${schoolData.id}`);
  console.log("  Keep the API worker running; it provisions the tenant schema and first admin membership.");

  const registrationPassword = process.env.REGISTER_TEST_PASSWORD?.trim();
  if (registrationPassword) {
    const registration = await requestJson(apiBase, "/auth/register", {
      method: "POST",
      body: {
        schoolName: `CORE Self-Registration ${suffix}`,
        subdomain: `core-reg-${suffix}`.slice(0, 50),
        schoolEmail: `registered-school-${suffix}@example.test`,
        schoolPhone: "+2348000000002",
        schoolCategory: "primary_secondary",
        schoolOwnership: "private",
        state: "Lagos",
        city: "Ikeja",
        firstName: "Registered",
        lastName: "Admin",
        email: `registered-admin-${suffix}@example.test`,
        password: registrationPassword,
        phone: "+2348000000003",
      },
    });
    console.log("✓ Self-registration request submitted.");
    console.log(`  Subdomain: core-reg-${suffix}`);
    console.log(`  Admin email: registered-admin-${suffix}@example.test`);
    console.log(`  Response: ${JSON.stringify(registration)}`);
    console.log("  Complete email OTP verification using the code from your development mail transport.");
  } else {
    console.log("ℹ Self-registration skipped. Set REGISTER_TEST_PASSWORD to also call POST /auth/register.");
  }
}

main()
  .catch((error) => {
    console.error("\n✗ Test-data bootstrap failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma().catch(() => undefined);
  });
