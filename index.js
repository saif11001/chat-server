import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";

import { connectDB } from "./config/db.js";
import { authenticateSocket } from "./middlewares/authMiddleware.js";
import { Message } from "./models/message.model.js";

dotenv.config();

const app = express();
const server = createServer(app);

const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        credentials: true
    }
});

app.get('/test', (req, res) => {
  res.sendFile(join(__dirname, 'test.html'));
});

import jwt from "jsonwebtoken";
import { User } from "./models/user.model.js";

const authenticateRequest = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Not authenticated" });

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ message: "User not found" });

        req.userId = user._id.toString();
        req.userRole = user.role;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Not authenticated" });
    }
};

app.get("/conversations", authenticateRequest, async (req, res) => {
    if (req.userRole !== "support" && req.userRole !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
    }

    try {
        const conversations = await Message.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$conversationId",
                    lastMessage: { $first: "$content" },
                    lastMessageAt: { $first: "$createdAt" },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$isRead", false] }, { $eq: ["$senderRole", "user"] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { lastMessageAt: -1 } }
        ]);

        const userIds = conversations.map((c) => c._id);
        const users = await User.find({ _id: { $in: userIds } }).select("name email");
        const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

        const result = conversations.map((c) => ({
            conversationId: c._id,
            lastMessage: c.lastMessage,
            lastMessageAt: c.lastMessageAt,
            unreadCount: c.unreadCount,
            user: userMap[c._id] || null
        }));

        res.json({ success: true, conversations: result });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch conversations" });
    }
});

app.get("/messages/:conversationId", authenticateRequest, async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (req.userRole === "user" && req.userId !== conversationId) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch messages" });
    }
});

io.use(authenticateSocket);

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    if (socket.userRole === "support" || socket.userRole === "admin") {
        socket.join("support_team");
    } else {
        socket.join(`user_${socket.userId}`);
    }

    socket.on("chat message", async ({ conversationId, content }) => {
        try {
            const message = await Message.create({
                conversationId,
                senderId: socket.userId,
                senderRole: socket.userRole,
                content
            });

            if (socket.userRole === "user") {
                io.to("support_team").emit("chat message", message);
                io.to(`user_${socket.userId}`).emit("chat message", message);
            } else {
                io.to(`user_${conversationId}`).emit("chat message", message);
                io.to("support_team").emit("chat message", message);
            }
        } catch (error) {
            console.error("Failed to save message:", error.message);
        }
    });

    socket.on("typing", ({ conversationId }) => {
        if (socket.userRole === "user") {
            socket.to("support_team").emit("typing", { conversationId, role: "user" });
        } else {
            socket.to(`user_${conversationId}`).emit("typing", { conversationId, role: "support" });
        }
    });

    socket.on("stop typing", ({ conversationId }) => {
        if (socket.userRole === "user") {
            socket.to("support_team").emit("stop typing", { conversationId, role: "user" });
        } else {
            socket.to(`user_${conversationId}`).emit("stop typing", { conversationId, role: "support" });
        }
    });

    socket.on("mark read", async ({ conversationId }) => {
        try {
            const roleToMark = socket.userRole === "user" ? { $ne: "user" } : "user";
            await Message.updateMany(
                { conversationId, senderRole: roleToMark, isRead: false },
                { $set: { isRead: true } }
            );

            if (socket.userRole === "user") {
                io.to("support_team").emit("messages read", { conversationId });
            } else {
                io.to(`user_${conversationId}`).emit("messages read", { conversationId });
            }
        } catch (error) {
            console.error("Failed to mark messages read:", error.message);
        }
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.userId}`);
    });
});

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Chat server running at http://localhost:${PORT}`);
    });
});