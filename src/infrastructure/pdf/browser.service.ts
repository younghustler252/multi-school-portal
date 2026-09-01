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

    async renderHtmlToPdf(html: string): Promise<Buffer> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent(html, {
                waitUntil: "load",
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