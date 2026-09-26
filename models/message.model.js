import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: String,
            required: true
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        senderRole: {
            type: String,
            enum: ["user", "support", "admin"],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        isRead: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

export const Message = mongoose.model("Message", messageSchema);