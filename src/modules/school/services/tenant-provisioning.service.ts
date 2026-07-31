import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../../../generated/public";

export class TenantProvisioningService {
    constructor(
        private readonly prisma: PrismaClient
    ) {}

    async provision(schemaName: string) {
        console.log(
            `🏗️ Creating tenant schema: ${schemaName}`
        );

        await this.createSchema(schemaName);

        await this.applyTenantMigrations(schemaName);

        await this.seedTenant(schemaName);

        console.log(
            `✅ Tenant ready: ${schemaName}`
        );
    }


    private async createSchema(schemaName: string) {
        await this.prisma.$executeRawUnsafe(`
            CREATE SCHEMA IF NOT EXISTS "${schemaName}";
        `);
    }


    private async applyTenantMigrations(
        schemaName: string
    ) {

        const migrationsPath = join(
            process.cwd(),
            "prisma/migrations"
        );


        const migrations = readdirSync(
            migrationsPath
        )
        .sort();


        for (const migration of migrations) {

            const sqlPath = join(
                migrationsPath,
                migration,
                "migration.sql"
            );


            const sql = readFileSync(
                sqlPath,
                "utf8"
            );


            console.log(
                `⚙️ Applying ${migration}`
            );


            await this.prisma.$executeRawUnsafe(`
                SET search_path TO "${schemaName}";

                ${sql}
            `);
        }
    }


    private async seedTenant(schemaName: string) {

        await this.prisma.$executeRawUnsafe(`
            SET search_path TO "${schemaName}";

            INSERT INTO "SchoolSettings"
            (
                id,
                "createdAt",
                "updatedAt"
            )
            VALUES
            (
                gen_random_uuid(),
                NOW(),
                NOW()
            )
            ON CONFLICT DO NOTHING;
        `);
    }
}