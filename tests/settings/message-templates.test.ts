/*
| MESSAGE TEMPLATES (no database, no server): saving, plan gating per channel, reset, preview, the resolver
| the automation uses, permission keys and route wiring.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { SaveTemplateDto, PreviewTemplateDto } from "../../src/modules/message-templates/dtos/message-template.dto";
import { MessageTemplateService } from "../../src/modules/message-templates/services/message-template.service";
import {
    ListMessageTemplatesUseCase, GetMessageTemplateUseCase, SaveMessageTemplateUseCase,
    ResetMessageTemplateUseCase, PreviewMessageTemplateUseCase, normalizeChannel,
} from "../../src/modules/message-templates/usecases/message-template.usecases";

const code = (c: string) => (e: any) => e.code === c;

function world(plan: { email?: boolean; sms?: boolean } = { email: true, sms: false }) {
    const rows = new Map<string, any>();
    const audit: any[] = [];
    const repo: any = {
        async findAll() { return [...rows.values()]; },
        async find(key: string, channel: string) { return rows.get(`${key}:${channel}`) ?? null; },
        async upsert(t: any, userId: string) { const r = { ...t, updatedById: userId, updatedAt: new Date("2026-10-29T10:00:00Z") }; rows.set(`${t.key}:${t.channel}`, r); return r; },
        async remove(key: string, channel: string) { return rows.delete(`${key}:${channel}`); },
    };
    const d: any = {
        messageTemplateRepository: repo,
        entitlementsService: { async checkFeature(_s: string, key: string) {
            const ok = key === "notifications.email" ? plan.email : key === "notifications.sms" ? plan.sms : true;
            return ok ? { allowed: true } : { allowed: false, reason: "not_granted" };
        } },
        auditService: { async log(p: any) { audit.push(p); } },
    };
    d.messageTemplateService = new MessageTemplateService(d);
    return {
        rows, audit, d,
        list: new ListMessageTemplatesUseCase(d), get: new GetMessageTemplateUseCase(d), save: new SaveMessageTemplateUseCase(d),
        reset: new ResetMessageTemplateUseCase(d), preview: new PreviewMessageTemplateUseCase(d), service: d.messageTemplateService as MessageTemplateService,
    };
}

describe("message templates: permissions", () => {
    it("registry stays valid; keys have their own module name; only staff", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        const mine = PERMISSION_REGISTRY.filter(p => p.module === "message_templates");
        assert.deepEqual(mine.map(p => p.key).sort(), ["message_templates.manage", "message_templates.view"]);
        for (const p of mine) assert.deepEqual([...p.personas], ["STAFF"]);
    });
    it("principal holds both; no other editable role, student or guardian does", () => {
        const granted = (k: string) => ROLE_TEMPLATES.find(r => r.key === k)!.permissions.map(p => p.key);
        assert.ok(granted("principal").includes("message_templates.manage"));
        for (const k of ["teacher", "bursar", "branch_principal", "student", "guardian"]) assert.ok(!granted(k).some(x => x.startsWith("message_templates.")), k);
    });
});

describe("message templates: listing and defaults", () => {
    it("every message lists its placeholders and the default text for all three channels", async () => {
        const w = world();
        const { templates } = await w.list.execute();
        const reminder = templates.find(t => t.key === "fee.reminder")!;
        assert.deepEqual(reminder.channels.map(c => c.channel), ["IN_APP", "EMAIL", "SMS"]);
        assert.ok(reminder.variables.some(v => v.name === "student_name"));
        for (const c of reminder.channels) { assert.equal(c.isCustomized, false); assert.equal(c.body, c.default.body); }
    });
    it("an unknown message is a 404 with a stable code", async () => {
        const w = world();
        await assert.rejects(w.get.execute("fee.nonsense"), code("TEMPLATE_UNKNOWN"));
        await assert.rejects(w.service.render("nope", "EMAIL", {}), code("TEMPLATE_UNKNOWN"));
    });
    it("channel names are forgiving in a URL but nothing else is allowed", () => {
        assert.equal(normalizeChannel("email"), "EMAIL");
        assert.equal(normalizeChannel("in_app"), "IN_APP");
        assert.equal(normalizeChannel("in-app"), "IN_APP");
        assert.throws(() => normalizeChannel("fax"), code("TEMPLATE_INVALID"));
    });
});

describe("message templates: saving", () => {
    it("saves the school's words, audits old and new, and the service now uses them", async () => {
        const w = world();
        const out = await w.save.execute("sch", "u1", "fee.reminder", "email", { subject: "Pay up, {{guardian_name}}", body: "Hello {{guardian_name}}, {{amount_due}} for {{student_name}}." });
        const email = out.channels.find(c => c.channel === "EMAIL")!;
        assert.equal(email.isCustomized, true);
        assert.equal(email.body, "Hello {{guardian_name}}, {{amount_due}} for {{student_name}}.");
        assert.equal(w.audit.length, 1);
        assert.equal(w.audit[0].oldValue, null);
        const r = await w.service.render("fee.reminder", "EMAIL", { guardian_name: "Ada", amount_due: "₦5", student_name: "Tolu" });
        assert.equal(r.subject, "Pay up, Ada");
        assert.equal(r.body, "Hello Ada, ₦5 for Tolu.");
        assert.equal(r.notificationType, "fee_reminder");
        const other = await w.service.render("fee.reminder", "IN_APP", {});
        assert.equal(other.subject, "Fee payment reminder", "other channels keep the default");
    });
    it("refuses a placeholder the message does not have, and saves nothing", async () => {
        const w = world();
        await assert.rejects(w.save.execute("sch", "u1", "fee.reminder", "email", { subject: "x", body: "Your password is {{password}}" }), code("TEMPLATE_INVALID"));
        assert.equal(w.rows.size, 0);
        assert.equal(w.audit.length, 0);
    });
    it("SMS needs the plan feature; email needs it too; in-app never does", async () => {
        const noSms = world({ email: true, sms: false });
        await assert.rejects(noSms.save.execute("sch", "u1", "fee.reminder", "sms", { body: "Pay {{amount_due}}" }), code("FEATURE_NOT_AVAILABLE"));
        const noEmail = world({ email: false, sms: true });
        await assert.rejects(noEmail.save.execute("sch", "u1", "fee.reminder", "email", { subject: "s", body: "b" }), code("FEATURE_NOT_AVAILABLE"));
        await noEmail.save.execute("sch", "u1", "fee.reminder", "in_app", { subject: "s", body: "b" });
        const full = world({ email: true, sms: true });
        const out = await full.save.execute("sch", "u1", "fee.reminder", "sms", { subject: "ignored?", body: "Pay {{amount_due}}" }).catch((e: any) => e);
        assert.equal(out.code, "TEMPLATE_INVALID", "an SMS has no subject");
        await full.save.execute("sch", "u1", "fee.reminder", "sms", { body: "Pay {{amount_due}}" });
        assert.equal(full.rows.get("fee.reminder:SMS").subject, null);
    });
    it("a school version that is switched off is kept but the default is used", async () => {
        const w = world();
        await w.save.execute("sch", "u1", "fee.overdue", "in_app", { subject: "Custom", body: "Custom body", isActive: false });
        const r = await w.service.render("fee.overdue", "IN_APP", { student_name: "Tolu", amount_due: "₦1", due_date: "d" });
        assert.equal(r.subject, "Fee payment overdue");
        const view = (await w.get.execute("fee.overdue")).channels.find(c => c.channel === "IN_APP")!;
        assert.equal(view.hasSavedVersion, true);
        assert.equal(view.isCustomized, false);
    });
});

describe("message templates: reset and preview", () => {
    it("reset brings the default back, audits once, and is safe to repeat", async () => {
        const w = world();
        await w.save.execute("sch", "u1", "fee.reminder", "in_app", { subject: "S", body: "B" });
        const out = await w.reset.execute("sch", "u1", "fee.reminder", "in_app");
        assert.equal(out.channels.find(c => c.channel === "IN_APP")!.isCustomized, false);
        await w.reset.execute("sch", "u1", "fee.reminder", "in_app");
        assert.deepEqual(w.audit.map(a => a.action), ["message_templates.updated", "message_templates.reset"]);
    });
    it("preview renders a draft with sample data, saves nothing, and reports SMS cost", async () => {
        const w = world();
        const p = await w.preview.execute("fee.reminder", "sms", { body: "{{school_name}}: {{amount_due}} due {{due_date}}" });
        assert.equal(p.body, "Your School: ₦45,000.00 due 15 Nov 2026");
        assert.equal((p as any).sms.encoding, "UCS-2", "the naira sign makes it unicode, which costs more per message");
        assert.equal(w.rows.size, 0);
        const own = await w.preview.execute("fee.reminder", "in_app", {});
        assert.ok(own.body.includes("Tolu Adeyemi"), "no draft means the current text");
        await assert.rejects(w.preview.execute("fee.reminder", "email", { subject: "x", body: "{{secret}}" }), code("TEMPLATE_INVALID"));
    });
    it("an email preview is HTML-safe even for a hostile template", async () => {
        const w = world();
        const p = await w.preview.execute("fee.reminder", "email", { subject: "S", body: "<img src=x onerror=alert(1)> {{student_name}}" });
        assert.ok(!p.paragraphs.join("").includes("<img"));
        assert.ok(p.paragraphs.join("").includes("&lt;img"));
    });
});

describe("message templates: request validation and wiring", () => {
    it("DTOs are strict", () => {
        assert.ok(SaveTemplateDto.safeParse({ subject: "s", body: "b" }).success);
        assert.equal(SaveTemplateDto.safeParse({ body: "" }).success, false);
        assert.equal(SaveTemplateDto.safeParse({ body: "b", locale: "fr" }).success, false);
        assert.ok(PreviewTemplateDto.safeParse({}).success);
    });
    it("every route has a permission and the module is mounted and registered", () => {
        const src = readFileSync("src/modules/message-templates/routes/message-template.routes.ts", "utf8");
        const lines = src.split("\n").filter(l => /^router\.(get|put|post|delete)\(/.test(l));
        assert.equal(lines.length, 5);
        for (const l of lines) assert.match(l, /\.\.\.guard\("message_templates\.(view|manage)"\)/, l);
        const strip = (f: string) => readFileSync(f, "utf8").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
        assert.match(strip("src/routes/index.ts"), /router\.use\("\/message-templates",\s*messageTemplateRouter\)/);
        assert.match(strip("src/container/index.ts"), /registerMessageTemplates,/);
    });
});
