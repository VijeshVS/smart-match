import mongoose, { Document, Schema } from 'mongoose';

const candidateSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    field: {
        type: String,
        required: true,
    },
    skills: {
        type: [String],
        required: true,
    },
    experience: {
        type: Number,
        required: true,
    },
    rightSwipes: {
        type: Number,
        default: 0,
    },
    leftSwipes: {
        type: Number,
        default: 0,
    },
    reviews: {
        type: [String],
        default: [],
    },
    level: {
        type: Number,
        default: 1,
    },
    education: {
        type: [
            {
                college: {
                    type: String,
                    required: true,
                },
                degree: {
                    type: String,
                    required: true,
                },
                branchOfStudy: {
                    type: String,
                    required: true,
                },
                yearOfGraduation: {
                    type: Number,
                    required: true,
                },
                gpa: {
                    type: Number,
                    required: true,
                },
            },
        ],
        required: true,
    },
    previousExperience: {
        type: [
            {
                company: {
                    type: String,
                    required: true,
                },
                role: {
                    type: String,
                    required: true,
                },
                duration: {
                    type: String,
                    required: true,
                },
                responsibilities: {
                    type: [String],
                    required: true,
                },
            }
        ]
    },
});