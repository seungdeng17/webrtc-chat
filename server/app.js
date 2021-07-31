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

  socket.emit('setMyId', socketId);
  io.sockets.emit('users', [...users.values()]);

  // sdp
  socket.on('offer', ({ callee, offer }) => io.to(callee).emit('sendOfferToCallee', { caller: socketId, offer }));
  socket.on('answer', ({ caller, answer }) => io.to(caller).emit('sendAnswerToCaller', { answer }));

  // ice candidate
  socket.on('new-ice-candidate', async ({ target, candidate }) => {
    if (candidate) {
      io.to(target).emit('sendCandidateToTarget', { candidate });
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
