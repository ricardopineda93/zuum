const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    // Join the room
    socket.join(roomId);
    // Broadcast to everyone in the room that this new user has joined except for joining user
    socket.to(roomId).broadcast.emit("user-connected", userId);

    // Listen for when this user disconnects, broadcast a message to the room that the user has left with the disconnected user's Id
    socket.on("disconnect", () => {
      socket.to(roomId).broadcast.emit("user-disconnected", userId);
    });
  });
});

server.listen(3000);
