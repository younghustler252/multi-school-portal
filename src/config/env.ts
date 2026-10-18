import dotenv from "dotenv";
import path   from "path";
import { z }  from "zod";

/*
|--------------------------------------------------------------------------
| LOAD ENV FILE
|--------------------------------------------------------------------------
*/
const NODE_ENV = process.env.NODE_ENV || "development";
const envFile  = NODE_ENV === "production" ? ".env.production" : ".env.development";

dotenv.config({
    path: path.resolve(process.cwd(), envFile),
});

/*
|--------------------------------------------------------------------------
| ENV SCHEMA VALIDATION
| App won't start if any required variable is missing
|--------------------------------------------------------------------------
*/
const envSchema = z.object({

    // ── App ──────────────────────────────────────────────────────────────
    NODE_ENV:         z.enum(["development", "production", "test"]).default("development"),
    PORT:             z.string().default("5000"),
    BASE_DOMAIN:     z.string().min(3),          
    COOKIE_DOMAIN:   z.string().optional(),     
    PUBLIC_URL_PORT: z.string().optional(),  
    ADMIN_SUBDOMAIN:  z.string().default("admin"),

    // ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL:     z.string().url(),

    // ── JWT ──────────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET:      z.string().min(32),
    JWT_REFRESH_SECRET:     z.string().min(32),
    JWT_ACCESS_EXPIRES_IN:  z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    //encryption key
    ENCRYPTION_KEY: z.string().min(32).max(64),

    // ── Supabase ─────────────────────────────────────────────────────────
    SUPABASE_URL:         z.string().url(),
    SUPABASE_SERVICE_KEY: z.string(),
    SUPABASE_BUCKET:      z.string(),
    SUPABASE_PUBLIC_BUCKET: z.string(),

    // ── Email ────────────────────────────────────────────────────────────
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().default("587").optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default("noreply@hotspotportal.local").optional(),

    // ── SMS ──────────────────────────────────────────────────────────────
    TERMII_API_KEY:   z.string(),
    TERMII_SENDER_ID: z.string(),

    // ── Paystack ─────────────────────────────────────────────────────────
    PAYSTACK_SECRET_KEY: z.string(),
    PAYSTACK_PUBLIC_KEY: z.string(),

    // ── Redis ────────────────────────────────────────────────────────────
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.string().default("6379"),

    //brevo 
    BREVO_API_KEY:      z.string().min(1).optional(),
    BREVO_SENDER_EMAIL: z.string().email().optional(),
    BREVO_SENDER_NAME:  z.string().min(1).default("Hotspot Support").optional(),

    //sentry
    SENTRY_DSN: z.string().optional(),
});

/*
|--------------------------------------------------------------------------
| PARSE + VALIDATE
|--------------------------------------------------------------------------
*/
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/
export const env = {
    // ── App ──────────────────────────────────────────────────────────────
    NODE_ENV:        parsed.data.NODE_ENV,
    PORT:            parsed.data.PORT,
    BASE_DOMAIN: parsed.data.BASE_DOMAIN,
    COOKIE_DOMAIN:   parsed.data.COOKIE_DOMAIN,
    PUBLIC_URL_PORT: parsed.data.PUBLIC_URL_PORT,
    ADMIN_SUBDOMAIN: parsed.data.ADMIN_SUBDOMAIN,

    // ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL:    parsed.data.DATABASE_URL,

    // ── JWT ──────────────────────────────────────────────────────────────
    jwt: {
        accessSecret:     parsed.data.JWT_ACCESS_SECRET,
        refreshSecret:    parsed.data.JWT_REFRESH_SECRET,
        accessExpiresIn:  parsed.data.JWT_ACCESS_EXPIRES_IN,
        refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
    },

    encryptionKey: parsed.data.ENCRYPTION_KEY,

    // ── Supabase ─────────────────────────────────────────────────────────
    supabase: {
        url:        parsed.data.SUPABASE_URL,
        serviceKey: parsed.data.SUPABASE_SERVICE_KEY,
        bucket:     parsed.data.SUPABASE_BUCKET,
        publicBucket: parsed.data.SUPABASE_PUBLIC_BUCKET,
    },

    // ── Email ────────────────────────────────────────────────────────────
    smtp: {
        host: parsed.data.SMTP_HOST || "",
        port: parseInt(parsed.data.SMTP_PORT || "587"),
        user: parsed.data.SMTP_USER || "",
        pass: parsed.data.SMTP_PASS || "",
        from: parsed.data.SMTP_FROM || "noreply@hotspotportal.local",
    },


    // ── SMS ──────────────────────────────────────────────────────────────
    termii: {
        apiKey:   parsed.data.TERMII_API_KEY,
        senderId: parsed.data.TERMII_SENDER_ID,
    },

    // ── Paystack ─────────────────────────────────────────────────────────
    paystack: {
        secretKey: parsed.data.PAYSTACK_SECRET_KEY,
        publicKey: parsed.data.PAYSTACK_PUBLIC_KEY,
    },

    // ── Redis ────────────────────────────────────────────────────────────
    redis: {
        host: parsed.data.REDIS_HOST,
        port: parseInt(parsed.data.REDIS_PORT),
    },

     brevo: {
        apiKey:      parsed.data.BREVO_API_KEY || "",
        senderEmail: parsed.data.BREVO_SENDER_EMAIL || "",
        senderName:  parsed.data.BREVO_SENDER_NAME || "Hotspot Support",
    },

    sentryDsn: parsed.data.SENTRY_DSN,

} as const;