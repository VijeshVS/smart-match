import mongoose from "mongoose";

const hrSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
	},
	companyName: {
		type: String,
		required: true,
	},
	points:{
        type: Number,
        default: 0
    },
    accessLevel:{
        type: Number,
        default: 1
    },
    subscribed:{
        type: Boolean,
        default: false
    }
});

export const Hr = mongoose.model("Hr", hrSchema);