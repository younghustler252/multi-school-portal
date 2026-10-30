import crypto from "crypto";
import { env } from "../../config/env";

const ALGORITHM = "aes-256-gcm";

export class EncryptionService {
    private readonly key: Buffer;

    constructor() {
        this.key = Buffer.from(env.encryptionKey, "hex");
    }

    encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // iv + authTag + ciphertext, base64-packed together — self-contained,
        // no separate storage needed for the IV/tag
        return Buffer.concat([iv, authTag, encrypted]).toString("base64");
    }

    decrypt(packed: string): string {
        const buffer = Buffer.from(packed, "base64");
        const iv        = buffer.subarray(0, 12);
        const authTag   = buffer.subarray(12, 28);
        const encrypted = buffer.subarray(28);

        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    }
}