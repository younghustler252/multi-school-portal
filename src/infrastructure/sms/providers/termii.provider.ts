import axios                              from "axios";
import { ISmsProvider, SendSmsOptions } from "../interfaces/sms.interface";
import { env }                            from "../../../config/env";

/*
|--------------------------------------------------------------------------
| TERMII PROVIDER
| Nigerian SMS provider — supports local sender IDs
| Docs: https://developers.termii.com
|--------------------------------------------------------------------------
*/

export class TermiiProvider implements ISmsProvider {
    private readonly baseUrl = "https://v3.api.termii.com/api";

    async send(options: SendSmsOptions): Promise<void> {
        const numbers = Array.isArray(options.to)
            ? options.to
            : [options.to];

        // Termii supports bulk SMS in one request
        // Normalize Nigerian numbers to international format
        const normalizedNumbers = numbers.map(n => this.normalizeNumber(n));

        await axios.post(`${this.baseUrl}/sms/send/bulk`, {
            api_key:  env.termii.apiKey,
            to:       normalizedNumbers,
            from:     env.termii.senderId,
            sms:      options.message,
            type:     "plain",
            channel:  "generic",
        });
    }

    // ── Normalize number ─────────────────────────────────────────────────
    // Converts 08012345678 → 2348012345678
    private normalizeNumber(phone: string): string {
        const cleaned = phone.replace(/\D/g, "");

        if (cleaned.startsWith("234")) return cleaned;
        if (cleaned.startsWith("0"))   return `234${cleaned.slice(1)}`;

        return cleaned;
    }
}