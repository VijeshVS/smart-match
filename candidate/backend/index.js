import express, { json } from "express";
import cors from "cors";
import { config } from "dotenv";
import { default as connectDB } from "./utils/db.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import Groq from "groq-sdk";

config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
		You are a very helpful assistant that summarises a candidate's profile.
		Here is the candidate's profile: ${JSON.stringify(profile)}
		Return the summary in JSON format with the following fields:
		{
			"summary": [
				"Point 1",
				"Point 2",
				"Point 3"
			]
		}
		You must make sure that you do not include any unnecessary information or explanations.
		Make sure the summary is accurate and it highlights key points efficiently.
		Only return the JSON Object.
		
		Example output:
		{
			"summary": [
				"B.Tech in Computer Science with a focus on Python and Data Analysis.",
				"Built a Movie Recommendation System project.",
				"Interested in Machine Learning and NLP."
			]
		}
	`

	try {
		const completion = await groq.chat.completions.create({
			model: "openai/gpt-oss-120b",
			messages: [{ role: "user", content: prompt }],
			response_format: { type: "json_object" },
		});
		const responseText = completion.choices[0]?.message?.content || "{}";
		const parsed = JSON.parse(responseText);
		return res.json(parsed);
	} catch (error) {
		console.error("Error summarising profile:", error);
		return res.status(500).json({ error: "Failed to summarise profile" });
	}
}
);

app.post('/suggestProfile', async (req, res) => {
	const { profile } = req.body;
	
	console.log(profile)

	const prompt =`
		You are a helpful assistant who gives suggestions to improve a candidate's profile.
		Your task is to give suggestions to improve the candidate's profile based on the information provided.

		Instructions:
		- Be concise and focus on the most relevant information.
		- Do NOT give generic advice. Your suggestions must be tailored to the user's current profile.
		- Avoid repeating what's already on the profile.
		- Suggest specific actions, skills to learn, projects to build, or experiences to gain.
		- Return the suggestions in a valid JSON format as shown below.

		Here is the candidate's profile: ${JSON.stringify(profile)}
		
		Output format:
		{
			"suggestions": [
				"Suggestion 1",
				"Suggestion 2",
				"Suggestion 3"
			]
		}

		Example output:
		{
			"suggestions": [
				"Build an end-to-end NLP project such as a chatbot using spaCy or HuggingFace to showcase practical ML skills.",
				"Contribute to open-source Flask projects on GitHub to demonstrate real-world backend development experience.",
				"Learn and apply basic MLOps tools like Docker and MLflow to take your ML projects to the next level."
			]
		}

		Do not include any other information or explanations.
		Only return the JSON Object. 
	`

	try {
		const completion = await groq.chat.completions.create({
			model: "openai/gpt-oss-120b",
			messages: [{ role: "user", content: prompt }],
			response_format: { type: "json_object" },
		});
		const responseText = completion.choices[0]?.message?.content || "{}";
		const parsed = JSON.parse(responseText);
		return res.json(parsed);
	} catch (error) {
		console.error("Error suggesting profile improvements:", error);
		return res.status(500).json({ error: "Failed to suggest profile improvements" });
	}
}
);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
