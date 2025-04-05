import express, { json } from "express";
import cors from "cors";
import { config } from "dotenv";
import { default as connectDB } from "./utils/db.js";
import candidateRoutes from "./routes/candidateRoutes.js";

config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origins: "*",
}));
app.use(json());

connectDB();

app.get("/", (req, res) => {
	res.send("HR is running...");
});

app.use("/api/hr", hrRoutes);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
