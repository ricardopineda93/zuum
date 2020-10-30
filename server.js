const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

// Setting express' view engine to esj
app.set("view engine", "ejs");

// Instructing express to serve files from the 'public' directory
app.use(express.static("public"));

// Redirects requests without a roomId provided by redirecting to a randomly generated roomId
app.get("/", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

// Renders the "room" file on a given roomId, passing in the roomId variable to the esj file to use
app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

// Handles the socket connection
io.on("connection", (socket) => {
  // Listen and react to "join-room event"
  socket.on("join-room", (roomId, userId) => {
    // Join the room
    socket.join(roomId);
    // Broadcast to everyone in the room that this new user has joined except for joining user
    socket.to(roomId).broadcast.emit("user-connected", userId);
    // On a user sending a chat message, broadcast to the room there is a new chat message
    socket.on("send-chat", (message, sendingUserId = "unknown-connection") => {
      io.in(roomId).emit("new-chat-message", message, sendingUserId);
    });
    // Listen for when users register a display name for the chat
    socket.on(
      "register-display-name",
      (userId, newDisplayName, oldDisplayName = "") => {
        io.in(roomId).emit(
          "new-display-name-registered",
          userId,
          newDisplayName,
          oldDisplayName
        );
      }
    );
    // Listen for when this user disconnects, broadcast a message to the room that the user has left with the disconnected user's Id
    socket.on("disconnect", () => {
      socket.to(roomId).broadcast.emit("user-disconnected", userId);
    });
  });
});

// Listen on port 3000
server.listen(3000);
