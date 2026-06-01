import "./shared/types/express"; // ✅ load request augmentation
import "dotenv/config";   // ✅ auto-runs dotenv
import app from "./app";
import connectDb from "./config/db";



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} ✅`);
});

connectDb();
