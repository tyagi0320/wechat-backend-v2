const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const connectDB = require("./db");
const User = require("./User");
require("dotenv").config();

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://wechat-frontend-v2.vercel.app/",
        methods: ["GET", "POST"]
    }
});

// WebSocket handling
io.on("connection", (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // Register user with socket ID
    socket.on("register", async (email) => {
        try {
            await User.findOneAndUpdate({ email }, { socketId: socket.id }, { upsert: true });
            console.log(`User ${email} registered with socket ID: ${socket.id}`);
        } catch (error) {
            console.error("Error registering user:", error);
        }
    });

    // Handle video call request
    socket.on("callUser", async ({ email, signalData, from }) => {
        try {
            const userToCall = await User.findOne({ email });
            if (userToCall?.socketId) {
                io.to(userToCall.socketId).emit("callUser", { signal: signalData, from });
                console.log(`Call request sent from ${from} to ${email}`);
            } else {
                console.log(`User ${email} not found or offline.`);
            }
        } catch (error) {
            console.error("Error handling call request:", error);
        }
    });

    // Handle call answer
    socket.on("answerCall", async ({ signal, to }) => {
        try {
            io.to(to).emit("callAccepted", signal);
            console.log(`Call answered by ${to}`);
        } catch (error) {
            console.error("Error handling call answer:", error);
        }
    });

    // Handle chat messages
    socket.on("sendMessage", async ({ sender, text }) => {
        try {
            io.to(socket.id).emit("receiveMessage", { sender, text }); // Send to sender
            socket.broadcast.emit("receiveMessage", { sender, text }); // Send to others
            console.log(`Message from ${sender}: ${text}`);
        } catch (error) {
            console.error("Error sending message:", error);
        }
    });

    // Handle user disconnection
    socket.on("disconnect", async () => {
        try {
            await User.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
            console.log(`User disconnected: ${socket.id}`);
        } catch (error) {
            console.error("Error handling user disconnection:", error);
        }
    });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
