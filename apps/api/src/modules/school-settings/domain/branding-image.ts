/*
| BRANDING IMAGE CHECK (pure). The stamp and the signature are shown on report cards and on the public school
| pages, so what is stored must really be a small picture, whatever the browser claimed.
| The type is read from the first bytes of the file (PNG, JPEG, WebP), never trusted from the upload's label.
*/
export const BRANDING_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type BrandingImageType = { mimetype: "image/png" | "image/jpeg" | "image/webp"; extension: "png" | "jpg" | "webp" };

export function sniffImageType(buffer: Uint8Array): BrandingImageType | null {
    const b = buffer;
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
        return { mimetype: "image/png", extension: "png" };
    }
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
        return { mimetype: "image/jpeg", extension: "jpg" };
    }
    // WebP: "RIFF" + 4 size bytes + "WEBP"
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
        return { mimetype: "image/webp", extension: "webp" };
    }
    return null;
}

export type ImageCheck = { ok: true; type: BrandingImageType } | { ok: false; code: "IMAGE_EMPTY" | "IMAGE_TOO_LARGE" | "IMAGE_TYPE_NOT_ALLOWED"; message: string };

export function checkBrandingImage(buffer: Uint8Array | undefined | null): ImageCheck {
    if (!buffer || buffer.length === 0) return { ok: false, code: "IMAGE_EMPTY", message: "The file is empty" };
    if (buffer.length > BRANDING_IMAGE_MAX_BYTES) return { ok: false, code: "IMAGE_TOO_LARGE", message: "The image must be 2 MB or smaller" };
    const type = sniffImageType(buffer);
    if (!type) return { ok: false, code: "IMAGE_TYPE_NOT_ALLOWED", message: "Upload a PNG, JPEG or WebP image" };
    return { ok: true, type };
}
