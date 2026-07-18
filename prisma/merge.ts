import * as fs from "fs";
import * as path from "path"

const base = `generator client {
  provider = "prisma-client-js" // Fixed generator identifier string
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
`;


const publicFiles = [
  "schema/school.prisma",
  "schema/auth.prisma",
  "schema/billing.prisma",
  "schema/audit.prisma",
  "schema/notifications.prisma",
];

const tenantFiles = [
  "schema/tenant/people.prisma",
  "schema/tenant/academic.prisma",
  "schema/tenant/attendance.prisma",
  "schema/tenant/grades.prisma",
  "schema/tenant/fees.prisma",
  "schema/tenant/notifications.prisma",
];

const readFile = (file: string) =>
  fs.readFileSync(path.join("prisma", file), "utf8");

const publicSchema = publicFiles.map(readFile).join("\n\n");
const tenantSchema = tenantFiles.map(readFile).join("\n\n");

const merged = `${base}

// ========================================
// PUBLIC SCHEMA
// ========================================
${publicSchema}

// ========================================
// SCHOOL/TENANT SCHEMA (per tenant)
// ========================================
${tenantSchema}
`;

fs.writeFileSync(path.join("prisma", "schema.prisma"), merged);
console.log("✅ schema.prisma merged successfully");
console.log(`   Public files: ${publicFiles.length}`);
console.log(`   Tenant files: ${tenantFiles.length}`);