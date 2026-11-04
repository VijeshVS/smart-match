import express from "express";
import fetch from "node-fetch"; // if using CommonJS: const fetch = require('node-fetch');
import Groq from "groq-sdk";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();
const PORT = Number(process.env.PORT) || 4001;
const CANDIDATE_API_URL = process.env.CANDIDATE_API_URL || "http://localhost:4000";

app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (_req, res) => {
  res.send("talent.ai API Gateway / Microservice v1.0 — recruiter-legacy");
});

function toFormat(candidate) {
  const skills = (candidate.skills || []).join(", ");
  const reviews = (candidate.reviews || [])
    .map((review) => {
      if (typeof review === "string") return `- "${review}"`;
      if (typeof review === "object" && review !== null) {
        return `- "${review.comment || review.text || JSON.stringify(review)}"`;
      }
      return `- "${String(review)}"`;
    })
    .join("\n");

  const educationStr = (candidate.education || [])
    .map(
      (edu) =>
        `- Completed a ${edu.degree} in ${edu.branchOfStudy} from ${edu.college}\n` +
        `  Graduated in ${edu.yearOfGraduation} with a GPA of ${edu.gpa}`
    )
    .join("\n");

  const experienceStr = (candidate.previousExperience || [])
    .map((exp, index) => {
      const responsibilities = (exp.responsibilities || []).join("\n   - ");
      return (
        `${index + 1}. Company: ${exp.company}\n` +
        `   Role: ${exp.role}\n` +
        `   Duration: ${exp.duration}\n` +
        `   Key Responsibilities:\n   - ${responsibilities}`
      );
    })
    .join("\n");

  const prompt =
    `**Candidate Profile Summary**\n\n` +
    `- **Field of Expertise**: ${candidate.field}\n` +
    `- **Years of Experience**: ${candidate.experience} years\n` +
    `**Technical & Soft Skills**:\n${skills}\n\n` +
    `**Swipe Metrics**:\n` +
    `- Positive Matches (Right Swipes): ${candidate.rightSwipes}\n` +
    `- Rejections (Left Swipes): ${candidate.leftSwipes}\n\n` +
    `**Reviews**:\n${reviews}\n\n` +
    `**Education Background**:\n${educationStr}\n\n` +
    `**Professional Experience**:\n${experienceStr}`;

  return prompt;
}

app.post("/evaluate", async (req, res) => {
  try {
    const user_message = req.body.message;

    const response = await fetch(`${CANDIDATE_API_URL}/api/candidates`);
    const candidates = await response.json();

    const results = [];

    for (const candidate of candidates) {
      const candidatePrompt = `
You are an AI assistant for a hiring manager. Your task is to analyze a candidate for a job position based on the provided information.
You are given the following:
Candidate Profile: ${toFormat(candidate)}
Message from the HR Manager: ${user_message}
Based on the candidate profile and the HR message, return true if the candidate is a good fit for the job position, otherwise return false.
Only return "true" or "false".
      `;

      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: candidatePrompt }],
      });
      const responseText =
        completion.choices[0]?.message?.content?.trim().toLowerCase() || "";

      const isFit = responseText.includes("true");

      if (isFit) results.push(candidate);
    }

    return res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to evaluate candidates" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
