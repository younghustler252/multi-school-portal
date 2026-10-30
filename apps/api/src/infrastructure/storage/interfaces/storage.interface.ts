export interface UploadFileOptions {
    bucket?:      string;
    folder:       string;
    filename:     string;
    file:         Buffer | Uint8Array;
    mimetype:     string;
    isPublic?:    boolean;
}

export interface UploadResult {
    url:      string;
    path:     string;
    filename: string;
    bucket:   string;
}

export interface IStorageProvider {
    upload(options: UploadFileOptions): Promise<UploadResult>;
    delete(path: string, bucket?: string): Promise<void>;
    getPublicUrl(path: string, bucket?: string): string;
    getSignedUrl(path: string, bucket?: string, expiresInSeconds?: number): Promise<string>;
}