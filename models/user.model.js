import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: String,
        email: String,
        role: {
            type: String,
            enum: ["user", "manager", "support", "admin"],
            default: "user"
        }
    },
    { timestamps: true }
);

export const User = mongoose.model("User", userSchema);