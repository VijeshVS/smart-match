import { Candidate } from "../models/candidateModel.js";

export const createCandidate = async (req, res) => {
	try {
		const candidate = new Candidate(req.body);
		await candidate.save();
		res.status(201).json(candidate);
	} catch (error) {
		console.log(error);
		res.status(400).json({ error: error.message });
	}
};

export const getAllCandidates = async (req, res) => {
	try {
		const candidates = await Candidate.find();
		res.status(200).json(candidates);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}

export const getCandidateById = async (req, res) => {
	try {
		const candidate = await Candidate.findById(req.params.id);
		if (!candidate)
			return res.status(404).json({ message: "Candidate not found" });
		res.status(200).json(candidate);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const updateCandidate = async (req, res) => {
	try {
		const updatedCandidate = await Candidate.findByIdAndUpdate(
			req.params.id,
			req.body,
			{ new: true, runValidators: true }
		);
		if (!updatedCandidate)
			return res.status(404).json({ message: "Candidate not found" });
		res.status(200).json(updatedCandidate);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

export const addRightSwipe = async (req, res) => {
	try {
		const candidate = await Candidate.findByIdAndUpdate(
			req.params.id,
			{ $inc: { rightSwipes: 1 } },
			{ new: true }
		);
		if (!candidate)
			return res.status(404).json({ message: "Candidate not found" });
		res.status(200).json(candidate);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

export const addLeftSwipe = async (req, res) => {
	try {
		const candidate = await Candidate.findByIdAndUpdate(
			req.params.id,
			{ $inc: { leftSwipes: 1 } },
			{ new: true }
		);
		if (!candidate)
			return res.status(404).json({ message: "Candidate not found" });
		res.status(200).json(candidate);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

export const addReview = async (req, res) => {
	try {
		const { review } = req.body;
		if (!review) return res.status(400).json({ message: "Review is required" });

		const candidate = await Candidate.findByIdAndUpdate(
			req.params.id,
			{ $push: { reviews: review } },
			{ new: true }
		);
		if (!candidate)
			return res.status(404).json({ message: "Candidate not found" });
		res.status(200).json(candidate);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};
