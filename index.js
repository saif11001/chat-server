import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import { authenticateSocket } from "./middlewares/authMiddleware.js";
import { Message } from "./models/message.model.js";

dotenv.config();

const app = express();
const server = createServer(app);

const __dirname = dirname(fileURLToPath(import.meta.url));

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        credentials: true
    }
});

// route الاختبار بس، هنشيله بعدين
app.get('/test', (req, res) => {
  res.sendFile(join(__dirname, 'test.html'));
});

// middleware بتاع التحقق من الهوية، يشتغل قبل أي اتصال
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
            }
        } catch (error) {
            console.error("Failed to save message:", error.message);
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