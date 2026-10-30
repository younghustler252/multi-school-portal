import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    SettingDef, validateSettingValue, coerceStored, resolveValues, describeSettings, validateDefinitions,
} from "../../src/foundation/settings.engine";
import { SETTING_DEFS, SETTING_BY_KEY, validateSettingsRegistry } from "../../src/foundation/settings.registry";

const def = (over: Partial<SettingDef>): SettingDef => ({
    key: "demo.value", kind: "integer", group: "Demo", label: "Demo value", description: "d", default: 3, min: 1, max: 10, ...over,
});

describe("settings engine: strict writing", () => {
    it("checks booleans, whole numbers and ranges", () => {
        assert.equal(validateSettingValue(def({ kind: "boolean", default: true }), true).ok, true);
        assert.equal(validateSettingValue(def({ kind: "boolean", default: true }), "true").ok, false);
        assert.equal(validateSettingValue(def({}), 5).ok, true);
        assert.equal(validateSettingValue(def({}), 5.5).ok, false);
        assert.equal(validateSettingValue(def({}), 0).ok, false);
        assert.equal(validateSettingValue(def({}), 11).ok, false);
        assert.equal(validateSettingValue(def({}), "5").ok, false);
    });
    it("checks enums, text and times", () => {
        const e = def({ kind: "enum", options: ["a", "b"], default: "a" });
        assert.equal(validateSettingValue(e, "b").ok, true);
        assert.equal(validateSettingValue(e, "c").ok, false);
        const s = def({ kind: "string", default: "x", maxLength: 5 });
        assert.deepEqual(validateSettingValue(s, "  hi  "), { ok: true, value: "hi" });
        assert.equal(validateSettingValue(s, "toolong").ok, false);
        assert.equal(validateSettingValue(s, 4).ok, false);
        const t = def({ kind: "time", default: "08:00" });
        assert.equal(validateSettingValue(t, "08:00").ok, true);
        assert.equal(validateSettingValue(t, "23:59").ok, true);
        assert.equal(validateSettingValue(t, "24:00").ok, false);
        assert.equal(validateSettingValue(t, "8:00").ok, false);
    });
});

describe("settings engine: forgiving reading", () => {
    it("accepts text written for a boolean or number, and falls back on bad values", () => {
        assert.deepEqual(coerceStored(def({ kind: "boolean", default: false }), "true"), { ok: true, value: true });
        assert.deepEqual(coerceStored(def({}), " 7 "), { ok: true, value: 7 });
        const defs = [def({ key: "demo.a" }), def({ key: "demo.b", kind: "boolean", default: true })];
        const v = resolveValues(defs, { "demo.a": 999, "demo.b": false });
        assert.equal(v["demo.a"], 3, "an out-of-range stored value falls back to the default");
        assert.equal(v["demo.b"], false);
        assert.equal(resolveValues(defs, {})["demo.b"], true, "no row means the default");
    });
    it("describes each setting with its default and whether the school changed it", () => {
        const rows = describeSettings([def({ key: "demo.a" }), def({ key: "demo.c" })], { "demo.a": 7 });
        assert.equal(rows[0].value, 7);
        assert.equal(rows[0].isOverridden, true);
        assert.equal(rows[0].default, 3);
        assert.equal(rows[1].isOverridden, false);
        assert.equal(rows[1].min, 1);
    });
});

describe("settings registry", () => {
    it("is valid", () => assert.deepEqual(validateSettingsRegistry(), []));
    it("keeps the behaviour from before the settings existed", () => {
        assert.equal(SETTING_BY_KEY.get("notifications.email_enabled")!.default, true);
        assert.equal(SETTING_BY_KEY.get("notifications.sms_enabled")!.default, false);
        assert.equal(SETTING_BY_KEY.get("automation.enabled")!.default, true);
    });
    it("refuses bad definitions", () => {
        assert.ok(validateDefinitions([def({ key: "BadKey" })]).length > 0);
        assert.ok(validateDefinitions([def({}), def({})]).some(p => p.includes("more than once")));
        assert.ok(validateDefinitions([def({ key: "finance.thing" })]).some(p => p.includes("finance")));
        assert.ok(validateDefinitions([def({ default: 99 })]).some(p => p.includes("default")));
        assert.ok(validateDefinitions([def({ kind: "enum", default: "a" })]).length > 0);
    });
    it("has unique keys", () => assert.equal(new Set(SETTING_DEFS.map(d => d.key)).size, SETTING_DEFS.length));
});
