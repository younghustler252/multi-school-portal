import { prisma, disconnectPrisma } from "../infrastructure/database/prisma/prisma.client";
import type { FoundationDb } from "./foundation.db";
import { syncFeatureDefinitions } from "./sync-definitions";
import { validatePermissionRegistry } from "./permissions.registry";
import { syncPermissions } from "./sync-permissions";
import { syncRoleTemplates } from "./sync-role-templates";
import { syncAuthTemplates } from "../modules/auth/auth.templates";
import { syncDefaultPlans } from "../modules/plans/plans.seed";
import { syncLedgerAccountTemplates, LedgerTemplateDb } from "../modules/ledger/ledger.templates";

/*
|--------------------------------------------------------------------------
| SYNC REGISTRIES (run on every deploy, after migrations)
| Upserts code-defined keys into their definition tables, in this order
| (later steps depend on earlier ones):
|   1. feature definitions   (entitlement keys)
|   2. permissions           (checked first; an invalid registry stops the run)
|   3. role templates        (reference permission keys)
|   4. message templates     (auth emails; each module adds its own templates here as it is built)
|   5. default plans         (created once, never overwritten; needs the feature definitions from step 1)
|   6. ledger account templates (chart of accounts for new schools; system accounts enforced, editable ones created once)
| Settings and automation rules join this list in their own passes.
| Exits with code 1 on any conflict, so a deploy pipeline stops instead of continuing silently.
|--------------------------------------------------------------------------
*/

async function main(): Promise<void> {
    const db = prisma as unknown as FoundationDb;
    let failed = false;

    const features = await syncFeatureDefinitions(db);
    console.log("features:", JSON.stringify(features, null, 2));
    if (features.conflicts.length) failed = true;

    const problems = validatePermissionRegistry();
    if (problems.length) {
        console.error("❌ Permission registry is invalid:\n - " + problems.join("\n - "));
        process.exitCode = 1;
        return;                                   // never write a broken registry to the database
    }

    const permissions = await syncPermissions(prisma);
    console.log("permissions:", JSON.stringify(permissions, null, 2));
    if (permissions.conflicts.length) failed = true;

    const roleTemplates = await syncRoleTemplates(prisma);
    console.log("roleTemplates:", JSON.stringify(roleTemplates, null, 2));
    if (roleTemplates.conflicts.length) failed = true;

    const messageTemplates = await syncAuthTemplates(prisma);
    console.log("messageTemplates:", JSON.stringify(messageTemplates, null, 2));

    const plans = await syncDefaultPlans(prisma);
    console.log("plans:", JSON.stringify(plans, null, 2));

    const ledger = await syncLedgerAccountTemplates(prisma as unknown as LedgerTemplateDb);
    console.log("ledgerAccountTemplates:", JSON.stringify(ledger, null, 2));
    if (ledger.conflicts.length) failed = true;

    if (failed) process.exitCode = 1;
}

main()
    .catch((err) => { console.error("❌ Registry sync failed:", err); process.exitCode = 1; })
    .finally(() => disconnectPrisma());
