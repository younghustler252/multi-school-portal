import app from "./app";
import connectDb from "./infrastructure/database/mongodb/connection";
connectDb()


const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Optional: graceful startup logging
process.on("uncaughtException", (err) => {
    console.error("🔥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err: any) => {
    console.error("⚠️ Unhandled Rejection:", err);
    server.close(() => process.exit(1));
});