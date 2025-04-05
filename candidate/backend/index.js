import express, { json } from "express";
import cors from "cors";
import { config } from "dotenv";
import { default as connectDB } from "./utils/db.js";
import candidateRoutes from "./routes/candidateRoutes.js";

config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: "*",
}));
app.use(json());

connectDB();

app.get("/", (req, res) => {
	res.send("Smart Match API is running...");
});

app.use("/api/candidates", candidateRoutes);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
