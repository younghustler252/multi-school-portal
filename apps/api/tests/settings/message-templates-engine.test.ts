import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    placeholdersIn, validateTemplateText, renderMessage, fillPlaceholders, smsLength, escapeHtml, BODY_MAX,
} from "../../src/modules/message-templates/domain/template-engine";
import { TEMPLATE_CATALOG, TEMPLATE_BY_KEY, variableNames, sampleValues, CHANNELS } from "../../src/modules/message-templates/domain/template-catalog";

const ALLOWED = ["student_name", "amount_due"];

describe("template engine: validation", () => {
    it("accepts a good message and tolerates spaces inside the braces", () => {
        assert.deepEqual(validateTemplateText("EMAIL", { subject: "Hi {{ student_name }}", body: "Owing {{amount_due}}" }, ALLOWED), []);
        assert.deepEqual(placeholdersIn("a {{ student_name }} b {{student_name}} c {{amount_due}}").sort(), ["amount_due", "student_name"]);
    });
    it("refuses unknown placeholders, naming them and listing the allowed ones", () => {
        const p = validateTemplateText("SMS", { body: "{{student_name}} {{password}} {{school_secret}}" }, ALLOWED);
        assert.equal(p.length, 1);
        assert.match(p[0], /\{\{password\}\}, \{\{school_secret\}\}/);
        assert.match(p[0], /Allowed: \{\{student_name\}\}, \{\{amount_due\}\}/);
    });
    it("refuses a broken placeholder, an empty body, a missing subject, an SMS subject, and long text", () => {
        assert.ok(validateTemplateText("SMS", { body: "Hello {{Student_Name}}" }, ALLOWED).length > 0, "capital letters are not placeholders");
        assert.ok(validateTemplateText("SMS", { body: "Hello {{student_name" }, ALLOWED).length > 0);
        assert.ok(validateTemplateText("SMS", { body: "   " }, ALLOWED).length > 0);
        assert.ok(validateTemplateText("EMAIL", { subject: "", body: "x" }, ALLOWED).some(p => /subject is needed/i.test(p)));
        assert.ok(validateTemplateText("IN_APP", { body: "x" }, ALLOWED).some(p => /subject is needed/i.test(p)));
        assert.ok(validateTemplateText("SMS", { subject: "no", body: "x" }, ALLOWED).some(p => /no subject/i.test(p)));
        assert.ok(validateTemplateText("SMS", { body: "x".repeat(BODY_MAX.SMS + 1) }, ALLOWED).some(p => /too long/.test(p)));
        assert.ok(validateTemplateText("EMAIL", { subject: "a\nb", body: "x" }, ALLOWED).some(p => /one line/.test(p)));
        assert.ok(validateTemplateText("EMAIL", { subject: "x".repeat(121), body: "x" }, ALLOWED).some(p => /subject is too long/.test(p)));
    });
});

describe("template engine: rendering", () => {
    it("fills placeholders in one pass: a value that looks like a placeholder is NOT expanded", () => {
        const r = fillPlaceholders("Hi {{student_name}}, owing {{amount_due}}", { student_name: "{{amount_due}}", amount_due: "₦5" });
        assert.equal(r.text, "Hi {{amount_due}}, owing ₦5");
    });
    it("a missing value becomes nothing and is reported", () => {
        const r = fillPlaceholders("Hi {{student_name}}{{amount_due}}", { student_name: "Tolu" });
        assert.equal(r.text, "Hi Tolu");
        assert.deepEqual(r.missing, ["amount_due"]);
    });
    it("EMAIL escapes the template text and the values, and makes paragraphs", () => {
        const r = renderMessage("EMAIL", { subject: "Hi {{student_name}}", body: "Dear <b>parent</b>,\n\n{{student_name}} owes\nmoney" }, { student_name: "<script>alert(1)</script>" });
        assert.ok(!r.body.includes("<script>") && !r.body.includes("<b>"));
        assert.ok(r.body.includes("&lt;script&gt;"));
        assert.equal(r.paragraphs.length, 2);
        assert.ok(r.paragraphs[1].includes("<br>"), "a single newline becomes a line break");
        assert.equal(r.subject, "Hi <script>alert(1)</script>", "the subject is plain text; the mail library handles it, we never put it in HTML");
    });
    it("SMS and in-app stay plain text, control characters are removed and values are capped", () => {
        const r = renderMessage("SMS", { body: "{{student_name}} owes {{amount_due}}" }, { student_name: "A\u0000B\u0007C", amount_due: "x".repeat(500) });
        assert.equal(r.subject, null);
        assert.ok(r.body.startsWith("A B C owes x"));
        assert.ok(r.body.length < 230);
        const plain = renderMessage("IN_APP", { subject: "S", body: "a & b" }, {});
        assert.equal(plain.body, "a & b");
        assert.equal(escapeHtml(`<&>"'`), "&lt;&amp;&gt;&quot;&#39;");
    });
});

describe("template engine: SMS length", () => {
    it("counts GSM-7 and unicode messages differently (the naira sign is not in GSM-7)", () => {
        assert.deepEqual(smsLength("Hello"), { characters: 5, encoding: "GSM-7", segments: 1 });
        assert.equal(smsLength("a".repeat(160)).segments, 1);
        assert.equal(smsLength("a".repeat(161)).segments, 2);
        assert.equal(smsLength("{").segments, 1, "an extension character counts double but still fits");
        assert.equal(smsLength("Fee ₦5,000").encoding, "UCS-2");
        assert.equal(smsLength("₦".repeat(70)).segments, 1);
        assert.equal(smsLength("₦".repeat(71)).segments, 2);
        assert.equal(smsLength("").segments, 0);
    });
});

describe("template catalog", () => {
    it("every default is valid for its own channel and uses only its own placeholders", () => {
        for (const def of TEMPLATE_CATALOG) {
            for (const ch of CHANNELS) {
                const d = def.defaults[ch];
                assert.deepEqual(validateTemplateText(ch, d, variableNames(def)), [], `${def.key} ${ch}`);
                const r = renderMessage(ch, d, sampleValues(def));
                assert.deepEqual(r.missing, [], `${def.key} ${ch} has a placeholder with no sample`);
            }
        }
    });
    it("default SMS fits in three messages with the sample values", () => {
        for (const def of TEMPLATE_CATALOG) assert.ok(smsLength(renderMessage("SMS", def.defaults.SMS, sampleValues(def)).body).segments <= 3, def.key);
    });
    it("keys are unique", () => assert.equal(TEMPLATE_BY_KEY.size, TEMPLATE_CATALOG.length));
});
