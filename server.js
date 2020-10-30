const e = require("express");
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

// Sockets room cache, storing the rooms and metadata about each connection in each room
const roomsCache = {};

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
    socket.join(roomId, (error) => {
      if (error) {
        console.error(error);
        socket.emit("error-message", error.message);
      } else {
        if (!roomsCache[roomId]) roomsCache[roomId] = {};
        roomsCache[roomId][socket.id] = { userId, displayName: userId };
      }
    });
    // Broadcast to everyone in the room that this new user has joined except for joining user
    socket.to(roomId).broadcast.emit("user-connected", userId);
    // On a user sending a chat message, broadcast to the room there is a new chat message
    socket.on("send-chat", (message) => {
      const sendingUser = roomsCache[roomId][socket.id];
      io.in(roomId).emit("new-chat-message", message, sendingUser);
    });
    // Listen for when users register a display name for the chat
    socket.on("register-display-name", (newDisplayName) => {
      const room = roomsCache[roomId];
      const displayNameIsTaken = !!Object.values(room).find(
        (user) => user.displayName === newDisplayName
      );
      if (displayNameIsTaken)
        socket.emit(
          "error-message",
          `The display name ${newDisplayName} is already in use in this call!`
        );
      else {
        const { displayName: oldDisplayName } = roomsCache[roomId][socket.id];
        roomsCache[roomId][socket.id].displayName = newDisplayName;
        const updatedUser = roomsCache[roomId][socket.id];
        io.in(roomId).emit(
          "new-display-name-registered",
          updatedUser,
          oldDisplayName
        );
      }
    });

    // Listen for when this user disconnects, broadcast a message to the room that the user has left with the disconnected user's Id
    socket.on("disconnect", () => {
      const disconnectedUser = roomsCache[roomId][socket.id];
      socket.to(roomId).broadcast.emit("user-disconnected", disconnectedUser);
      // Check to see if the room still exists in the io process
      const roomDisconnectedFromStillExists = !!io.sockets.adapter.rooms[
        roomId
      ];
      // If room still exists, just delete the newly-disconnected socket object from the cache
      if (roomDisconnectedFromStillExists) delete roomsCache[roomId][socket.id];
      // If the room no longer exists, delete the room entirely from the cache
      else delete roomsCache[roomId];
    });
  });
});

// Listen on port 3000
server.listen(3000);
