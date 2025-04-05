import express from "express";
import {
	createCandidate,
	getCandidateById,
	updateCandidate,
	addRightSwipe,
	addLeftSwipe,
	addReview,
	getAllCandidates,
} from "../controllers/candidateController.js";

const router = express.Router();

router.post("/", createCandidate);
router.get("/", getAllCandidates)
router.get("/:id", getCandidateById);
router.put("/:id", updateCandidate);
router.patch("/:id/rights", addRightSwipe);
router.patch("/:id/lefts", addLeftSwipe);
router.post("/:id/reviews", addReview);

export default router;