const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const myPeer = new Peer(undefined, { host: "/", port: "3001" });

// Create and mute the video element for the user client
const myVideoElement = document.createElement("video");
myVideoElement.muted = true;

// Global maps for tracking peer connections and userId:displayNames mappings
const peers = {};

// Global vars for tracking the user's userId
let userId;

// If the navigator singleton does not allow us to access media devices, alert the user and stop trying to run rest of script.
if (!navigator.mediaDevices)
  alert(
    "Unable to access camera and microphone! This has been blocked by broswer due to insecure connection :("
  );

// Grab the video and audio devices from the client machine
navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  // On success of that, work directly with the stream
  .then((userStream) => {
    // Add the user's own video stream to the UI
    addVideoStream(myVideoElement, userStream);

    // Have the Peer client listen for when we are receiving a call
    myPeer.on("call", (call) => {
      // answer the call with our own video stream
      call.answer(userStream);
      // Then listen for the other user's stream and add that video to our UI
      const otherVideoElement = document.createElement("video");
      call.on("stream", (otherUserStream) => {
        addVideoStream(otherVideoElement, otherUserStream);
      });
    });

    // Then have the socket listen for any new user connection events, connect to/ "call"
    // the new user via webRTC, and then add that new connected user's video stream to the UI
    socket.on("user-connected", (joiningUserId) => {
      console.log(`[${joiningUserId}] has JOINED the call!`);
      connectToNewUser(joiningUserId, userStream);
    });

    // Print the zuum welcome and chat instructions to the console.
    printChatWelcomeMessage();
  });

// Establish a connection with the RTC server, and once that is done,
myPeer.on("open", (peerConnectionId) => {
  // Emit the join-room event with the roomId and the userId
  socket.emit("join-room", ROOM_ID, peerConnectionId);
  userId = peerConnectionId;
});

socket.on("new-chat-message", (incomingMessage, { displayName }) => {
  console.log(`[${displayName}]: ${incomingMessage}`);
});

socket.on("new-display-name-registered", ({ displayName }, oldDisplayName) => {
  console.log(
    `"${oldDisplayName}" has changed their display name to: "${displayName}"`
  );
});

socket.on("error-message", (errorMessage) => {
  console.error(errorMessage);
});

// Listens for when another user disconnects, and closes that Peer call
socket.on("user-disconnected", ({ displayName, userId }) => {
  if (peers[userId]) peers[userId].close();
  console.log(`[${displayName}] has LEFT the call!`);
  alert(`${displayName} has left the call!`);
});

/*-----------------------------------------------*
 *                                               *
 *                   HELPERS                     *
 *                                               *
 ------------------------------------------------*/

// Function handles syncing up the video element to a user camera and mic stream, adding to the UI
function addVideoStream(videoElement, stream) {
  // Setting the video element source object to the hardware stream
  videoElement.srcObject = stream;
  // Adding event listener to play the video stream once it's metadata has been loaded
  videoElement.addEventListener("loadedmetadata", () => {
    videoElement.play();
  });
  // Then append this new video element to the grid container element
  videoGrid.append(videoElement);
}

// Function handles connecting to another user using the other user
function connectToNewUser(incomingUserId, thisUserStream) {
  // Call the incoming user by their userId and send them our stream
  const call = myPeer.call(incomingUserId, thisUserStream);
  // Create a new video element for the incoming user's video
  const otherUserVideoElement = document.createElement("video");
  // Listen for when we receive the incoming user's stream in response to them answering,
  // handle adding that stream to the UI
  call.on("stream", (otherUserStream) => {
    addVideoStream(otherUserVideoElement, otherUserStream);
  });
  // Listen for when the call with the incoming user closes, remove the element from the UI
  call.on("close", () => {
    otherUserVideoElement.remove();
  });

  // Finally, add this new peer stream to our variable that tracks our current peer connections
  peers[incomingUserId] = call;
}

// Welcome user to the console chat
function printChatWelcomeMessage() {
  console.info(`Welcome to zuum's console.chat!\n\nTo set a custom display name for yourself, use: setDisplayName("yourNameHere")\n\nTo send a message to the room, use: send("Hello, everyone!")
`);
}

// Handles sending message to room on behalf of user
function send(message) {
  socket.emit("send-chat", message);
  return "sent message ✅";
}

// Allows user to attempt to set a custom display name for the chat
// TODO: Figure out a way to save the userId : displayName mapping server side, new users
// won't have access to existing mapping and can also take an "already in use" display name
function setDisplayName(newDisplayName) {
  socket.emit("register-display-name", newDisplayName);
  return "sending request...";
}
