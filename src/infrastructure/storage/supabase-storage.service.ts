import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
    IStorageProvider,
    UploadFileOptions,
    UploadResult,
} from "./interfaces/storage.interface";
import { env } from "../../config/env";

/*
|--------------------------------------------------------------------------
| SUPABASE STORAGE SERVICE
| Generic file upload/delete service used by any module
| Each module passes its own folder path when calling upload()
|--------------------------------------------------------------------------
*/

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

    // ── Upload ────────────────────────────────────────────────────────────
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

        const url = this.getPublicUrl(filePath, bucket);

        return {
            url,
            path:     filePath,
            filename: uniqueName,
        };
    }

    // ── Delete ────────────────────────────────────────────────────────────
    async delete(filePath: string, bucket?: string): Promise<void> {
        const { error } = await this.client.storage
            .from(bucket ?? this.bucket)
            .remove([filePath]);

        if (error) {
            throw new Error(`Storage delete failed: ${error.message}`);
        }
    }

    // ── Get public URL ────────────────────────────────────────────────────
    getPublicUrl(filePath: string, bucket?: string): string {
        const { data } = this.client.storage
            .from(bucket ?? this.bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
}