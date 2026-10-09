import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error("Not authenticated"));
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN);

        if (decoded.type !== "chat") {
            return next(new Error("Not authenticated"));
        }

        const user = await User.findById(decoded.userId);

        if (!user) {
            return next(new Error("User not found"));
        }

        socket.userId = user._id.toString();
        socket.userRole = user.role;
        socket.userName = user.name;

        next();
    } catch (error) {
        next(new Error("Not authenticated"));
    }
};