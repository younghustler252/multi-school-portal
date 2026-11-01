import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
    IStorageProvider,
    UploadFileOptions,
    UploadResult,
} from "./interfaces/storage.interface";
import { env } from "../../config/env";

export class SupabaseStorageService implements IStorageProvider {
    private readonly client: SupabaseClient;
    private readonly bucket: string;

    constructor() {
        this.client = createClient(
            env.supabase.url,
            env.supabase.serviceKey,
        );
        this.bucket = env.supabase.bucket;

        console.log("🗄️  Storage provider: Supabase");
    }

    async upload(options: UploadFileOptions): Promise<UploadResult> {
        const bucket     = options.bucket ?? this.bucket;
        const ext        = path.extname(options.filename);
        const uniqueName = `${uuidv4()}${ext}`;
        const filePath   = `${options.folder}/${uniqueName}`;

        const { error } = await this.client.storage
            .from(bucket)
            .upload(filePath, options.file, {
                contentType: options.mimetype,
                upsert:      false,
            });

        if (error) {
            throw new Error(`Storage upload failed: ${error.message}`);
        }

        const isPublicBucket = bucket === env.supabase.publicBucket;
        const url = isPublicBucket ? this.getPublicUrl(filePath, bucket) : "";

        return {
            url,
            path:     filePath,
            filename: uniqueName,
            bucket,
        };
    }

    async delete(filePath: string, bucket?: string): Promise<void> {
        const { error } = await this.client.storage
            .from(bucket ?? this.bucket)
            .remove([filePath]);

        if (error) {
            throw new Error(`Storage delete failed: ${error.message}`);
        }
    }

    getPublicUrl(filePath: string, bucket?: string): string {
        const { data } = this.client.storage
            .from(bucket ?? this.bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    }

    async getSignedUrl(
        filePath:          string,
        bucket?:           string,
        expiresInSeconds = 300,
    ): Promise<string> {
        const { data, error } = await this.client.storage
            .from(bucket ?? this.bucket)
            .createSignedUrl(filePath, expiresInSeconds);

        if (error) {
            throw new Error(`Storage signed URL failed: ${error.message}`);
        }

        return data.signedUrl;
    }

    /** Several private files in ONE call (a list page). Files that cannot be signed are simply missing from the result. */
    async getSignedUrls(
        filePaths:         string[],
        bucket?:           string,
        expiresInSeconds = 300,
    ): Promise<Map<string, string>> {
        const out = new Map<string, string>();
        if (filePaths.length === 0) return out;

        const { data, error } = await this.client.storage
            .from(bucket ?? this.bucket)
            .createSignedUrls(filePaths, expiresInSeconds);

        if (error) {
            throw new Error(`Storage signed URLs failed: ${error.message}`);
        }
        for (const item of data ?? []) {
            if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl);
        }
        return out;
    }

    /** Writes to an exact path (replacing what is there). For generated files whose name we choose, e.g. cached PDFs. */
    async putAt(filePath: string, file: Buffer | Uint8Array, mimetype: string, bucket?: string): Promise<void> {
        const { error } = await this.client.storage.from(bucket ?? this.bucket).upload(filePath, file, { contentType: mimetype, upsert: true });
        if (error) throw new Error(`Storage upload failed: ${error.message}`);
    }

    /** The file's bytes, or null when there is no such file. */
    async download(filePath: string, bucket?: string): Promise<Buffer | null> {
        const { data, error } = await this.client.storage.from(bucket ?? this.bucket).download(filePath);
        if (error || !data) return null;
        return Buffer.from(await data.arrayBuffer());
    }

    /** File names directly inside a folder (not sub-folders). */
    async listFolder(folder: string, bucket?: string): Promise<string[]> {
        const { data, error } = await this.client.storage.from(bucket ?? this.bucket).list(folder, { limit: 100 });
        if (error) throw new Error(`Storage list failed: ${error.message}`);
        return (data ?? []).filter(f => f.id).map(f => f.name);
    }

    async deleteMany(filePaths: string[], bucket?: string): Promise<void> {
        if (filePaths.length === 0) return;
        const { error } = await this.client.storage.from(bucket ?? this.bucket).remove(filePaths);
        if (error) throw new Error(`Storage delete failed: ${error.message}`);
    }

    /** A temporary link that downloads the file under `filename`. */
    async getDownloadUrl(filePath: string, filename: string, bucket?: string, expiresInSeconds = 300): Promise<string> {
        const { data, error } = await this.client.storage.from(bucket ?? this.bucket).createSignedUrl(filePath, expiresInSeconds, { download: filename });
        if (error) throw new Error(`Storage signed URL failed: ${error.message}`);
        return data.signedUrl;
    }
}
