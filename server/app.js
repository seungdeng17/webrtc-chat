import express from 'express';
import http from 'http';
import cors from 'cors';
import socket from 'socket.io';

const PORT = 8000;
const CORS_CONFIG = {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
};

const app = express();
const httpServer = http.createServer(app);
const io = socket(httpServer, CORS_CONFIG);

app.use(cors(CORS_CONFIG.cors));

/**
 * socket io
 */
const users = new Map();

io.on('connection', (socket) => {
  const socketId = socket.id;
  if (!users.has(socketId)) users.set(socketId, socketId);

  socket.emit('set-my-id', socketId);
  io.sockets.emit('users', [...users.values()]);

  // sdp
  socket.on('offer', ({ callee, offer }) => {
    console.log('offer: ', offer);
    io.to(callee).emit('send-offer-to-callee', { caller: socketId, offer });
  });
  socket.on('answer', ({ caller, answer }) => {
    console.log('answer: ', answer);
    io.to(caller).emit('send-answer-to-caller', { answer });
  });

  // ice candidate
  socket.on('new-ice-candidate', async ({ target, candidate }) => {
    if (candidate) {
      console.log('candidate: ', candidate);
      io.to(target).emit('send-candidate-to-target', { candidate });
    }
  });

  socket.on('disconnect', () => users.delete(socketId));
});

/**
 * run server
 */
httpServer.listen(PORT, () => {
  console.log(`Server is running at ${PORT}!`);
});
