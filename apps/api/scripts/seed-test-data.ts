/**
 * Local-only CORE test-data bootstrap.
 *
 * Run from apps/api:
 *   ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true \
 *   TEST_PLATFORM_ADMIN_EMAIL=platform.admin@example.test \
 *   TEST_PLATFORM_ADMIN_PASSWORD='ChangeThis!234' \
 *   PLATFORM_BASE_URL=http://admin.localhost:5000 \
 *   npx tsx scripts/seed-test-data.ts
 *
 * Optional:
 *   REGISTER_TEST_PASSWORD='RegisterThis!234' npx tsx scripts/seed-test-data.ts
 *
 * Creates a local platform admin and the deterministic Greenfield Academy fixture.
 * Never deletes data. Do not run against production.
 *
 * Provisioning: a new school is queued by the platform API when it is created. A school that already exists but is
 * not provisioned yet (schemaProvisionedAt is NULL, e.g. after an earlier failed run) is resumed through the same
 * supported workflow the platform UI uses (POST /platform/schools/:id/provisioning/retry), so the provisioning worker
 * does the work. This script never writes schemaProvisionedAt itself. Running it again is always safe: if a job is
 * already queued or running, or the school is already provisioned, the retry is a no-op.
 *
 * For Docker-network databases, set TEST_DATABASE_HOST_ALLOWLIST to the exact
 * database hostname (for example 172.18.0.2) in .env.development. This is an
 * explicit per-environment opt-in; private-network hosts are not trusted by default.
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma, disconnectPrisma, getTenantClient } from "../src/infrastructure/database/prisma/prisma.client";
import { TenantContext } from "../src/infrastructure/database/prisma/tenant.context";

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
  const allowedDatabaseHosts = new Set([
    "localhost", "127.0.0.1", "::1",
    ...(process.env.TEST_DATABASE_HOST_ALLOWLIST ?? "")
      .split(",").map((host) => host.trim()).filter(Boolean),
  ]);
  if (!allowedDatabaseHosts.has(db.hostname)) {
    throw new Error(
      `Refusing to bootstrap against database host "${db.hostname}". ` +
      "For an intentional local Docker test database, add its exact hostname " +
      "to TEST_DATABASE_HOST_ALLOWLIST in .env.development.",
    );
  }

  const api = new URL(process.env.PLATFORM_BASE_URL || "http://admin.localhost:5000");
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
  if (!response.ok) {
    throw new ApiError(`${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(payload)}`, response.status, payload);
  }
  return payload;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly payload: any) { super(message); }
  /** The application's machine-readable error code, when the response carries one. */
  get code(): string | undefined { return this.payload?.code ?? this.payload?.error?.code; }
}

const TEST_SCHOOL = {
  name: "Greenfield Academy",
  subdomain: "greenfield-academy",
  email: "school@greenfield-academy.test",
  adminEmail: "admin@greenfield-academy.test",
};

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

type SchoolRow = NonNullable<Awaited<ReturnType<typeof prisma.school.findUnique>>>;

/**
 * Queue provisioning again for a school that exists but is not provisioned, through the platform API (the supported
 * workflow). Safe to repeat: "already provisioned" and "already in progress" are normal outcomes, not errors.
 */
async function resumeProvisioning(base: URL, token: string, school: SchoolRow) {
  if (school.schemaProvisionedAt) {
    console.log(`ℹ ${school.name} is already provisioned (${school.schemaName}); nothing to resume.`);
    return;
  }
  console.log(`ℹ ${school.name} exists but is not provisioned (schemaProvisionedAt is NULL); asking the platform to resume provisioning...`);
  try {
    await requestJson(base, `/platform/schools/${school.id}/provisioning/retry`, { method: "POST", token });
    console.log("✓ Provisioning queued for the worker.");
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.code === "PROVISIONING_IN_PROGRESS") {
      console.log("ℹ A provisioning job is already queued or running; waiting for it.");
    } else if (error instanceof ApiError && error.status === 409 && error.code === "ALREADY_PROVISIONED") {
      console.log("ℹ The school finished provisioning in the meantime.");
    } else {
      throw error;
    }
  }
}

/** The platform's own view of this school's provisioning job: queued | running | failed | stuck | provisioned. */
async function provisioningStatus(base: URL, token: string, subdomain: string) {
  const payload = await requestJson(base, `/platform/schools/provisioning?state=all&limit=100&search=${encodeURIComponent(subdomain)}`, { token });
  const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
  return rows.find((row) => row.subdomain === subdomain) ?? null;
}

async function waitForSchoolProvisioning(base: URL, token: string, subdomain: string, timeoutMs = 120_000, stuckGraceMs = 20_000) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let school = await prisma.school.findUnique({ where: { subdomain } });
  let lastState = "";

  while (Date.now() < deadline) {
    if (school?.schemaProvisionedAt && school.schemaName) {
      const schema = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_namespace WHERE nspname = ${school.schemaName}
        ) AS "exists"
      `;
      if (schema[0]?.exists) {
        console.log(`✓ Tenant schema provisioned: ${school.schemaName}`);
        return school;
      }
    }

    const status = await provisioningStatus(base, token, subdomain).catch(() => null);
    if (status && status.state !== lastState) {
      lastState = status.state;
      console.log(`  provisioning state: ${status.state}${status.attempts ? ` (attempts: ${status.attempts})` : ""}`);
    }
    if (status?.state === "failed") {
      throw new Error(
        `Tenant provisioning for ${subdomain} FAILED in the worker: ${status.failedReason ?? "no reason recorded"}\n` +
        "Fix the cause, then run this script again: it will resume provisioning. Do not mark the school provisioned manually.",
      );
    }
    if (status?.state === "stuck" && Date.now() - startedAt > stuckGraceMs) {
      throw new Error(
        `No provisioning job is queued or running for ${subdomain}, and it is not provisioned. ` +
        "Is the API worker running (and Redis reachable)? Start it and run this script again: it will queue provisioning.",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
    school = await prisma.school.findUnique({ where: { subdomain } });
  }

  const state = school
    ? `status=${school.status}, schemaName=${school.schemaName ?? "NULL"}, schemaProvisionedAt=${school.schemaProvisionedAt?.toISOString() ?? "NULL"}`
    : "school record not found";
  throw new Error(
    `Timed out waiting for tenant provisioning for ${subdomain} after ${timeoutMs / 1000}s (${state}). Check worker logs; do not mark the school provisioned manually.`,
  );
}


const FIXTURES = [
  { email: "admin2@greenfield-academy.test", first: "Second", last: "Admin", persona: "STAFF", roleKey: "school_admin" },
  { email: "teacher@greenfield-academy.test", first: "Test", last: "Teacher", persona: "STAFF", roleKey: "teacher" },
  { email: "bursar@greenfield-academy.test", first: "Test", last: "Bursar", persona: "STAFF", roleKey: "bursar" },
  { email: "guardian@greenfield-academy.test", first: "Test", last: "Guardian", persona: "GUARDIAN" },
  { email: "student@greenfield-academy.test", first: "Test", last: "Student", persona: "STUDENT" },
  { email: "multi.persona@greenfield-academy.test", first: "Multi", last: "Persona", persona: "BOTH" },
  { email: "password.change@greenfield-academy.test", first: "Password", last: "Change", persona: "STAFF", roleKey: "teacher", mustChangePassword: true },
  { email: "restricted@greenfield-academy.test", first: "Restricted", last: "Account", persona: "STAFF", roleKey: "teacher", suspended: true },
] as const;

async function upsertFixtureUser(email: string, firstName: string, lastName: string, passwordHash: string, mustChangePassword = false) {
  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash, firstName, lastName, isActive: true, isEmailVerified: true,
      emailVerifiedAt: new Date(), mustChangePassword, failedLoginCount: 0, lockedUntil: null,
    },
    create: {
      email, passwordHash, firstName, lastName, isActive: true, isEmailVerified: true,
      emailVerifiedAt: new Date(), mustChangePassword, failedLoginCount: 0,
    },
  });
}

async function seedGreenfieldAccounts(schoolId: string, schemaName: string, password: string) {
  if (!schemaName) throw new Error("Greenfield provisioning completed without a tenant schema name.");
  const passwordHash = await bcrypt.hash(password, 12);
  await TenantContext.run({ tenantSchema: schemaName, schoolId }, async () => {
    const db = getTenantClient();
    const branch = await db.branch.findFirst({ where: { isMain: true, deletedAt: null } });
    if (!branch) throw new Error("Greenfield has no active main branch; provisioning did not finish correctly.");

    // The founding admin is created by the provisioning worker. Only set its local fixture password here.
    const schoolAdmin = await prisma.user.findUnique({ where: { email: TEST_SCHOOL.adminEmail } });
    if (!schoolAdmin) throw new Error("Provisioning did not create the Greenfield school-admin user.");
    await prisma.user.update({ where: { id: schoolAdmin.id }, data: {
      passwordHash, isActive: true, isEmailVerified: true, emailVerifiedAt: new Date(),
      mustChangePassword: false, failedLoginCount: 0, lockedUntil: null,
    }});

    const ensureRole = async (persona: "STAFF" | "STUDENT" | "GUARDIAN", keys: string[]) => {
      const role = await db.schoolRole.findFirst({
        where: { persona, deletedAt: null, OR: keys.flatMap(key => [{ sourceTemplateKey: key }, { name: { equals: key, mode: "insensitive" as const } }]) },
        select: { id: true },
      });
      if (!role) throw new Error(`Missing provisioned ${persona} role template (expected one of: ${keys.join(", ")}).`);
      return role.id;
    };
    const roleIds = {
      admin: await ensureRole("STAFF", ["school_admin", "admin"]),
      teacher: await ensureRole("STAFF", ["teacher"]),
      bursar: await ensureRole("STAFF", ["bursar", "accountant"]),
      guardian: await ensureRole("GUARDIAN", ["guardian"]),
      student: await ensureRole("STUDENT", ["student"]),
    };

    const ensureMembership = async (userId: string, persona: "STAFF" | "STUDENT" | "GUARDIAN", entityId: string, roleId: string, status: "active" | "suspended" = "active") => {
      const membership = await db.membership.upsert({
        where: { userId_persona: { userId, persona } },
        update: { personaEntityId: entityId, status },
        create: { userId, persona, personaEntityId: entityId, status },
      });
      await db.membershipRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId } },
        update: {},
        create: { membershipId: membership.id, roleId },
      });
      await prisma.userSchool.upsert({
        where: { userId_schoolId: { userId, schoolId } },
        update: {},
        create: { userId, schoolId },
      });
      return membership;
    };

    // Link the provisioning-created school admin to the actual seeded school-admin role.
    const adminStaff = await db.staff.findUnique({ where: { userId: schoolAdmin.id } });
    if (!adminStaff) throw new Error("Provisioning did not create the school-admin Staff record.");
    const adminMembership = await db.membership.findUnique({ where: { userId_persona: { userId: schoolAdmin.id, persona: "STAFF" } } });
    if (!adminMembership) throw new Error("Provisioning did not create the school-admin STAFF membership.");
    await db.membershipRole.upsert({
      where: { membershipId_roleId: { membershipId: adminMembership.id, roleId: roleIds.admin } },
      update: {}, create: { membershipId: adminMembership.id, roleId: roleIds.admin },
    });
    await prisma.userSchool.upsert({
      where: { userId_schoolId: { userId: schoolAdmin.id, schoolId } },
      update: {}, create: { userId: schoolAdmin.id, schoolId },
    });

    let linkedStudentId: string | null = null;
    let linkedGuardianId: string | null = null;
    for (const fixture of FIXTURES) {
      const user = await upsertFixtureUser(fixture.email, fixture.first, fixture.last, passwordHash, "mustChangePassword" in fixture ? fixture.mustChangePassword : false);
      const createStaff = async (roleId: string, status: "active" | "suspended" = "active") => {
        const staff = await db.staff.upsert({
          where: { userId: user.id },
          update: { firstName: fixture.first, lastName: fixture.last, email: fixture.email, isActive: status === "active", deletedAt: null },
          create: { userId: user.id, firstName: fixture.first, lastName: fixture.last, email: fixture.email, category: "non_teaching", employmentType: "full_time" },
        });
        await db.staffBranch.upsert({ where: { staffId_branchId: { staffId: staff.id, branchId: branch.id } }, update: { isPrimary: true }, create: { staffId: staff.id, branchId: branch.id, isPrimary: true } });
        await ensureMembership(user.id, "STAFF", staff.id, roleId, status);
      };
      const createGuardian = async () => {
        const guardian = await db.guardian.upsert({
          where: { userId: user.id },
          update: { firstName: fixture.first, lastName: fixture.last, email: fixture.email, isActive: true },
          create: { userId: user.id, firstName: fixture.first, lastName: fixture.last, email: fixture.email },
        });
        linkedGuardianId = guardian.id;
        await ensureMembership(user.id, "GUARDIAN", guardian.id, roleIds.guardian);
      };
      if (fixture.persona === "STAFF") {
        const roleId = fixture.roleKey === "school_admin" ? roleIds.admin : fixture.roleKey === "bursar" ? roleIds.bursar : roleIds.teacher;
        await createStaff(roleId, "suspended" in fixture && fixture.suspended ? "suspended" : "active");
      } else if (fixture.persona === "GUARDIAN") {
        await createGuardian();
      } else if (fixture.persona === "STUDENT") {
        const student = await db.student.upsert({
          where: { userId: user.id },
          update: { firstName: fixture.first, lastName: fixture.last, branchId: branch.id, isActive: true },
          create: { userId: user.id, firstName: fixture.first, lastName: fixture.last, admissionNumber: "TEST-STUDENT-001", branchId: branch.id, admittedAt: new Date() },
        });
        linkedStudentId = student.id;
        await ensureMembership(user.id, "STUDENT", student.id, roleIds.student);
      } else {
        await createStaff(roleIds.teacher);
        await createGuardian();
      }
    }

    if (linkedGuardianId && linkedStudentId) {
      await db.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: linkedStudentId, guardianId: linkedGuardianId } },
        update: { relation: "guardian", isPrimary: true },
        create: { studentId: linkedStudentId, guardianId: linkedGuardianId, relation: "guardian", isPrimary: true },
      });
    }
  });
  console.log("✓ Greenfield fixture accounts and memberships are ready (passwords are not logged).");
}


async function main() {
  const apiBase = assertLocalOnly();
  const platformEmail = required("TEST_PLATFORM_ADMIN_EMAIL").toLowerCase();
  const platformPassword = required("TEST_PLATFORM_ADMIN_PASSWORD");
  const fixturePassword = required("TEST_FIXTURE_PASSWORD");
  console.log("CORE local test-data bootstrap");
  console.log(`API: ${apiBase.origin}`);
  console.log(`Database host: ${new URL(required("DATABASE_URL")).hostname}`);
  console.log(`Deterministic school fixture: ${TEST_SCHOOL.name} (${TEST_SCHOOL.subdomain})`);
  console.log("No records will be deleted.");

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

  // Platform-created school notifications require platform.name interpolation.
  // Initialize the singleton settings row before the first school is created.
  await requestJson(apiBase, "/platform/settings", {
    method: "PUT",
    token: accessToken,
    body: {
      platformName: "CORE Local Test Platform",
      supportEmail: "support@example.test",
      supportPhone: "+2348000000000",
      allowNewRegistrations: true,
      maintenanceMode: false,
    },
  });
  console.log("✓ Platform settings initialized.");

  const existingSchool = await prisma.school.findUnique({
    where: { subdomain: TEST_SCHOOL.subdomain },
  });

  if (!existingSchool) {
    const platformSchool = await requestJson(apiBase, "/platform/schools", {
      method: "POST",
      token: accessToken,
      body: {
        name: TEST_SCHOOL.name,
        subdomain: TEST_SCHOOL.subdomain,
        email: TEST_SCHOOL.email,
        phone: "+2348000000000",
        schoolCategory: "primary_secondary",
        schoolOwnership: "private",
        admin: {
          firstName: "Test", lastName: "School Admin",
          email: TEST_SCHOOL.adminEmail,
          phone: "+2348000000001",
        },
      },
    });
    const schoolData = unwrapData(platformSchool);
    console.log("✓ Greenfield Academy creation submitted.");
    if (schoolData?.id) console.log(`  School ID: ${schoolData.id}`);
  } else {
    console.log("ℹ Greenfield Academy already exists; reusing its record.");
    await resumeProvisioning(apiBase, accessToken, existingSchool);
  }

  console.log(`  Subdomain: ${TEST_SCHOOL.subdomain}`);
  console.log(`  Admin email: ${TEST_SCHOOL.adminEmail}`);
  const provisionedSchool = await waitForSchoolProvisioning(apiBase, accessToken, TEST_SCHOOL.subdomain);
  await seedGreenfieldAccounts(provisionedSchool.id, provisionedSchool.schemaName!, fixturePassword);

  const registrationPassword = process.env.REGISTER_TEST_PASSWORD?.trim();
  if (registrationPassword) {
    const registration = await requestJson(apiBase, "/auth/register", {
      method: "POST",
      body: {
        schoolName: "Greenfield Registration Academy",
        subdomain: "greenfield-registration",
        schoolEmail: "school@greenfield-registration.test",
        schoolPhone: "+2348000000002",
        schoolCategory: "primary_secondary",
        schoolOwnership: "private",
        state: "Lagos",
        city: "Ikeja",
        firstName: "Registered",
        lastName: "Admin",
        email: "admin@greenfield-registration.test",
        password: registrationPassword,
        phone: "+2348000000003",
      },
    });
    console.log("✓ Self-registration request submitted.");
    console.log("  Subdomain: greenfield-registration");
    console.log("  Admin email: admin@greenfield-registration.test");
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
