import puppeteer, { Browser } from "puppeteer";

class BrowserService {
    private browser: Browser | null = null;
    private launching: Promise<Browser> | null = null;

    async getBrowser(): Promise<Browser> {
        if (this.browser) {
            return this.browser;
        }

        if (!this.launching) {
            this.launching = puppeteer.launch({
                headless: true,

                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--no-first-run",
                    "--no-zygote",
                    "--single-process",
                ],
            });
        }

        try {
            this.browser = await this.launching;
        } finally {
            this.launching = null;
        }

        this.browser.on("disconnected", () => {
            this.browser = null;
        });

        return this.browser;
    }

    private running = 0;
    private waiting: Array<() => void> = [];
    private static readonly MAX_AT_ONCE = 2;

    /** At most MAX_AT_ONCE pages render at the same time; the rest wait their turn (a whole class printing must not exhaust memory). */
    private async slot<T>(fn: () => Promise<T>): Promise<T> {
        if (this.running >= BrowserService.MAX_AT_ONCE) await new Promise<void>(resolve => this.waiting.push(resolve));
        this.running++;
        try { return await fn(); }
        finally { this.running--; this.waiting.shift()?.(); }
    }

    /**
     * Renders HTML we built ourselves. The page cannot run scripts, and it may only load data: URLs and https images from `allowedImageHosts`
     * (never file:, http:, or another site), so nothing inside the page can read files or reach internal addresses.
     */
    async renderHtmlToPdf(html: string, allowedImageHosts: string[] = []): Promise<Buffer> {
        return this.slot(() => this.render(html, allowedImageHosts));
    }

    private async render(html: string, allowedImageHosts: string[]): Promise<Buffer> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        try {
            await page.setJavaScriptEnabled(false);
            await page.setRequestInterception(true);
            page.on("request", req => {
                const url = req.url();
                let ok = url.startsWith("data:") || url === "about:blank";
                if (!ok) { try { const u = new URL(url); ok = u.protocol === "https:" && allowedImageHosts.includes(u.hostname); } catch { ok = false; } }
                if (ok) void req.continue(); else void req.abort();
            });
            await page.setContent(html, {
                waitUntil: "load",
                timeout: 20000,
            });

            const pdf = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: {
                    top: "10mm",
                    bottom: "10mm",
                    left: "10mm",
                    right: "10mm",
                },
                timeout: 30000,
            });

            return Buffer.from(pdf);
        } finally {
            await page.close();
        }
    }

    async shutdown(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }

        this.launching = null;
    }
}

export const browserService = new BrowserService();