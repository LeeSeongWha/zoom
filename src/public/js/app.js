const socket = io();

const myFace = document.getElementById('myFace');
const muteBtn = document.getElementById('mute');
const cameraBtn = document.getElementById('camera');
const camerasSelect = document.getElementById('cameras');

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: 'user' },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(myStream);
  }
}

getMedia();

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = 'Unmute';
    muted = true;
  } else {
    muteBtn.innerText = 'Mute';
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = 'Turn Camera Off';
    cameraOff = false;
  } else {
    cameraBtn.innerText = 'Turn Camera On';
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === 'video');
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener('click', handleMuteClick);
cameraBtn.addEventListener('click', handleCameraClick);
camerasSelect.addEventListener('input', handleCameraChange);

//Welcome Form (Join a room.)
const welcome = document.getElementById('welcome');
const call = document.getElementById('call');

call.hidden = true;

form = welcome.querySelector('form');

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();

  const roomNameInput = form.querySelector('#roomName');
  const nameInput = welcome.querySelector('#nickname');
  console.log(nameInput.value);
  await initCall();
  roomName = roomNameInput.value;
  roomNameInput.value = '';
  const changeNameInput = room.querySelector('#name input');
  changeNameInput.value = nameInput.value;

  socket.emit('join_room', roomName, nameInput.value, showRoom);
  nameInput.addEventListener('submit', handleNicknameSubmit);
}

form.addEventListener('submit', handleWelcomeSubmit);

// Socket Code

// Peer A
socket.on('welcome', async () => {
  myDataChannel = myPeerConnection.createDataChannel('chat');
  myDataChannel.addEventListener('message', (event) => {
    console.log(event.data);
  });
  console.log('made data channel');
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log('sent the offer');
  socket.emit('offer', offer, roomName);
});

// Peer B
socket.on('offer', async (offer) => {
  myPeerConnection.addEventListener('datachannel', (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener('message', (event) => {
      console.log(event.data);
    });
  });
  console.log('received answer');
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit('answer', answer, roomName);
});

socket.on('answer', (answer) => {
  console.log('received answer');
  myPeerConnection.setRemoteDescription(answer);
});

socket.on('ice', (ice) => {
  console.log('received candidate');
  myPeerConnection.addIceCandidate(ice);
});

// RTC Code

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
        ],
      },
    ],
  });
  myPeerConnection.addEventListener('icecandidate', handleIce);
  myPeerConnection.addEventListener('addstream', handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log('sent candidate');
  socket.emit('ice', data.candidate, roomName);
}

function handleAddStream(data) {
  const peersStream = document.getElementById('peersStream');
  peersStream.srcObject = data.stream;
}

// chat

const room = document.getElementById('room');
const leaveBtn = document.getElementById('leave');

room.hidden = true;
leaveBtn.hidden = true;

async function handleMessageSubmit(event) {
  event.preventDefault();
  const input = room.querySelector('#msg input');
  const value = input.value;
  socket.emit('new_message', input.value, roomName, () => {
    addMessage(`You: ${value}`);
  });
  input.value = '';
}

async function handleNicknameSubmit(event) {
  event.preventDefault();
  const input = welcome.querySelector('#name input');
  const nickname = input.value;
  socket.emit('nickname', nickname);
  showRoom();
}

async function showRoom() {
  room.hidden = false;
  leaveBtn.hidden = false;
  const h4 = room.querySelector('h4');
  h4.innerText = `Room ${roomName}`;
  const msgForm = room.querySelector('#msg');
  msgForm.addEventListener('submit', handleMessageSubmit);
}

async function addMessage(message) {
  const ul = chattingBox.querySelector('ul');
  const li = document.createElement('li');
  li.innerText = message;
  ul.appendChild(li);
}

socket.on('hello', (user, newCount) => {
  const h4 = room.querySelector('h4');
  h4.innerText = `Room ${roomName} (${newCount})`;
  addMessage(`${user} joined the room.`);
});

socket.on('bye', (left, newCount) => {
  const h4 = room.querySelector('h4');
  h4.innerText = `Room ${roomName} (${newCount})`;
  addMessage(`${left} left the room.`);
});

socket.on('new_message', addMessage);

// socket.on('room_change', (rooms) => {
//   const roomList = welcome.querySelector('ul');
//   roomList.innerHTML = '';
//   if (rooms.length === 0) {
//     return;
//   }
//   rooms.forEach((room) => {
//     const li = document.createElement('li');
//     li.innerText = room;
//     roomList.append(li);
//   });
// });
