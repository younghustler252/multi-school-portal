import { createHash } from "node:crypto";
import type { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";

/*
|--------------------------------------------------------------------------
| PDF CACHE
| Rendered PDFs are expensive. We cache them in private storage at a
| deterministic path:
|
|   schools/{schoolId}/report-cards/{termId}/single/{cardId}/{hash16}.pdf
|   schools/{schoolId}/report-cards/{termId}/classes/{classId}/{hash16}.pdf
|
| The hash covers everything that affects the pixels:
|   - the full template data JSON (snapshot, remarks)
|   - the template name
|   - RENDER_VERSION (bump this whenever the HTML renderer changes)
|   - branding version: school.updatedAt + settings.updatedAt (logo, stamp,
|     signature, letterhead all reuse the same URL paths; updatedAt is the
|     proxy for "has anything changed")
|
| On a cache hit we re-use the stored bytes. On a miss we render, upload
| best-effort (error = log and continue), and return.
|
| Old hashed files under the same folder are cleaned up on every write
| (there should only ever be 1 per card/class; if the upload fails the
| stale copy will be served until the next successful render, which is fine).
|
| Single-flight: concurrent requests for the exact same key share one render.
|--------------------------------------------------------------------------
*/

/** Bump this whenever the HTML/CSS renderer changes in a way that affects the printed output. */
export const RENDER_VERSION = "1";

export interface PdfCacheStore {
    /** Read cached bytes, or null if not present. */
    get(path: string): Promise<Buffer | null>;
    /** Write. Should not throw (best-effort). */
    put(path: string, data: Buffer): Promise<void>;
    /** All file names directly inside this folder (not sub-folders). */
    listFolder(folder: string): Promise<string[]>;
    /** Delete multiple full paths (best-effort). */
    deleteMany(paths: string[]): Promise<void>;
}

/** Adapts our Supabase storage service into the minimal PdfCacheStore interface. */
export class SupabasePdfCacheStore implements PdfCacheStore {
    constructor(private readonly storage: SupabaseStorageService) {}

    get(path: string): Promise<Buffer | null> {
        return this.storage.download(path);
    }
    async put(path: string, data: Buffer): Promise<void> {
        await this.storage.putAt(path, data, "application/pdf");
    }
    async listFolder(folder: string): Promise<string[]> {
        return this.storage.listFolder(folder);
    }
    async deleteMany(paths: string[]): Promise<void> {
        await this.storage.deleteMany(paths);
    }
}

type BrandingVersion = { schoolUpdatedAt: Date | string | null; settingsUpdatedAt: Date | string | null };

/** Compute the content hash (first 16 hex chars of sha256). */
export function pdfHash(templateName: string, data: unknown, branding: BrandingVersion): string {
    const payload = JSON.stringify({
        v: RENDER_VERSION,
        t: templateName,
        d: data,
        bSchool: branding.schoolUpdatedAt ? new Date(branding.schoolUpdatedAt).toISOString() : null,
        bSettings: branding.settingsUpdatedAt ? new Date(branding.settingsUpdatedAt).toISOString() : null,
    });
    return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export class PdfCacheService {
    /** { key → pending render promise } — avoids redundant concurrent renders for the same card/class. */
    private readonly inflight = new Map<string, Promise<Buffer>>();

    constructor(private readonly store: PdfCacheStore) {}

    /**
     * Get or render a single report card PDF.
     * @param folder  e.g. "schools/s1/report-cards/t1/single/cardId"
     * @param hash    pdfHash() of the template data
     * @param render  called only on cache miss
     */
    async getSingle(
        folder: string,
        hash: string,
        render: () => Promise<Buffer>,
    ): Promise<{ buffer: Buffer; cached: boolean }> {
        const path = `${folder}/${hash}.pdf`;

        // cache hit
        const hit = await this.store.get(path).catch(() => null);
        if (hit) return { buffer: hit, cached: true };

        // deduplicate concurrent renders
        return this.dedupe(`single:${path}`, async () => {
            const buffer = await render();
            await this.writeAndEvict(folder, path, buffer);
            return buffer;
        }).then(buffer => ({ buffer, cached: false }));
    }

    /**
     * Get or render a whole-class PDF.
     * @param folder  e.g. "schools/s1/report-cards/t1/classes/classId"
     */
    async getClass(
        folder: string,
        hash: string,
        render: () => Promise<Buffer>,
    ): Promise<{ buffer: Buffer; cached: boolean }> {
        const path = `${folder}/${hash}.pdf`;
        const hit = await this.store.get(path).catch(() => null);
        if (hit) return { buffer: hit, cached: true };
        return this.dedupe(`class:${path}`, async () => {
            const buffer = await render();
            await this.writeAndEvict(folder, path, buffer);
            return buffer;
        }).then(buffer => ({ buffer, cached: false }));
    }

    /** Write the new file, then delete any old hashed pdfs in the same folder (best-effort). */
    private async writeAndEvict(folder: string, newPath: string, buffer: Buffer): Promise<void> {
        await this.store.put(newPath, buffer).catch(err => {
            console.warn("[PdfCacheService] upload failed (non-fatal):", err?.message ?? err);
        });
        // Evict old versions in the background (don't block the response)
        void this.evictOld(folder, newPath).catch(() => {/* best-effort */});
    }

    private async evictOld(folder: string, keepPath: string): Promise<void> {
        const names = await this.store.listFolder(folder);
        const keepName = keepPath.split("/").pop()!;
        const stale = names.filter(n => n.endsWith(".pdf") && n !== keepName).map(n => `${folder}/${n}`);
        if (stale.length) await this.store.deleteMany(stale);
    }

    private async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const existing = this.inflight.get(key) as Promise<T> | undefined;
        if (existing) return existing;
        const p = fn().finally(() => this.inflight.delete(key));
        this.inflight.set(key, p as unknown as Promise<Buffer>);
        return p;
    }
}
