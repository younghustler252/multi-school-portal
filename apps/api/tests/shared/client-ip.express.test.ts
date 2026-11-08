/*
| The behaviour that matters, with a real Express app and real sockets: which client IP does req.ip give us?
| The setting is produced by parseTrustProxy, the same code the app uses. The test client is always on loopback,
| so it plays the part of "the reverse proxy" (or of an attacker connecting directly).
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { parseTrustProxy } from "../../src/shared/utils/trust-proxy";

const bare = (ip: string | undefined) => (ip ?? "").replace(/^::ffff:/, "");

const serverFor = (setting: string | undefined) => {
    const app = express();
    app.set("trust proxy", parseTrustProxy(setting, "production"));
    app.get("/ip", (req, res) => { res.json({ ip: bare(req.ip) }); });
    return http.createServer(app);
};

const ipSeenBy = (server: http.Server, headers: Record<string, string> = {}) =>
    new Promise<string>((resolve, reject) => {
        const { port } = server.address() as AddressInfo;
        http.get({ host: "127.0.0.1", port, path: "/ip", headers }, (res) => {
            let body = ""; res.on("data", (c) => (body += c));
            res.on("end", () => resolve(JSON.parse(body).ip)); 
        }).on("error", reject);
    });

describe("client IP and TRUST_PROXY (real Express)", () => {
    const servers: Record<string, http.Server> = {};
    const start = async (name: string, setting: string | undefined) => {
        servers[name] = serverFor(setting);
        await new Promise<void>((r) => servers[name].listen(0, "127.0.0.1", r));
    };

    before(async () => {
        await start("off", undefined);
        await start("loopback", "loopback");
        await start("oneHop", "1");
        await start("otherProxy", "10.0.0.0/8");
    });
    after(() => { for (const s of Object.values(servers)) s.close(); });

    it("trust off: a forged X-Forwarded-For is ignored", async () => {
        assert.equal(await ipSeenBy(servers.off, { "x-forwarded-for": "9.9.9.9" }), "127.0.0.1");
    });

    it("our proxy trusted: the real client address is used", async () => {
        assert.equal(await ipSeenBy(servers.loopback, { "x-forwarded-for": "203.0.113.7" }), "203.0.113.7");
        assert.equal(await ipSeenBy(servers.oneHop,   { "x-forwarded-for": "203.0.113.7" }), "203.0.113.7");
    });

    it("our proxy appends to what the client sent: the client's forged left entry is ignored", async () => {
        const header = { "x-forwarded-for": "9.9.9.9, 203.0.113.7" };     // forged by the client, then the real peer added by the proxy
        assert.equal(await ipSeenBy(servers.loopback, header), "203.0.113.7");
    });

    it("a direct caller that is not a trusted proxy cannot choose its IP", async () => {
        assert.equal(await ipSeenBy(servers.otherProxy, { "x-forwarded-for": "9.9.9.9" }), "127.0.0.1");
    });

    it("with our proxy trusted but no header, the peer address is used", async () => {
        assert.equal(await ipSeenBy(servers.loopback), "127.0.0.1");
    });
});
