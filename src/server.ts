import app from "./app";
import { env } from "./config/env";
import { initContainer, disposeContainer } from "./container";

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${env.NODE_ENV}`);
});

initContainer();

// Graceful shutdown — finish existing requests before closing
const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        await disposeContainer();  
        console.log("✅ HTTP server closed");
        process.exit(0);
    });

    // Force kill if shutdown takes too long
    setTimeout(() => {
        console.error("❌ Forced shutdown after timeout");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM")); 
process.on("SIGINT", () => shutdown("SIGINT"));   

process.on("uncaughtException", (err) => {
    console.error("🔥 Uncaught Exception:", err);
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    console.error("⚠️ Unhandled Rejection:", err);
    shutdown("unhandledRejection");
});