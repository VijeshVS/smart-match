import express, { json } from "express";
import cors from "cors";
import { config } from "dotenv";
import { default as connectDB } from "./utils/db.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
config();
const app = express();
const PORT = 3000;

app.use(cors({
    origin: "*",
}));

app.use(json());

connectDB();

app.get("/", (req, res) => {
	res.send("Smart Match API is running...");
});

app.use("/api/candidates", candidateRoutes);

app.post('/summariseProfile', async (req, res) => {
	const { profile } = req.body;
	
	console.log(profile)

	const prompt =`
		You are a helpful assistant that summarises a candidate's profile.
		Your task is to create a summary of the candidate's profile based on the information provided.
		Please be concise and focus on the most relevant information.
		Here is the candidate's profile: ${JSON.stringify(profile)}
		Return the summary in JSON format with the following fields:
		{
			summary: string[]
		}
		Do not include any other information or explanations.
		Only return the JSON object.
	`

	const result = await model.generateContent([prompt]);

	const json = result.response.text();
  	const analysis = JSON.parse(json.slice(7, -4));

    return res.json(analysis);
}
);

app.post('/suggestProfile', async (req, res) => {
	const { profile } = req.body;
	
	console.log(profile)

	const prompt =`
		You are a helpful assistant who gives suggestions to improve a candidate's profile.
		Your task is to give suggestions to improve the candidate's profile based on the information provided.
		Please be concise and focus on the most relevant information.
		Here is the candidate's profile: ${JSON.stringify(profile)}
		Make sure the suggestions are not generic and you give user-specific suggestions
		Return the suggestions in JSON format with the following fields:
		{
			suggestions: string[]
		}
		Do not include any other information or explanations.
		Only return the JSON object. 
	`

	const result = await model.generateContent([prompt]);

	const json = result.response.text();
  	const analysis = JSON.parse(json.slice(7, -4));

    return res.json(analysis);
}
);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
