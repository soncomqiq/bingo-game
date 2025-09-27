import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*'
  }
});

app.use(cors());
app.use(express.json());

const games = new Map();

const PASSWORD_MIN_LENGTH = 4;
const SALT_BYTE_LENGTH = 16;

const hashPassword = (password, salt = crypto.randomBytes(SALT_BYTE_LENGTH).toString('hex')) => {
  const normalizedPassword = password.trim();
  const hash = crypto.createHmac('sha256', salt).update(normalizedPassword).digest('hex');
  return {
    salt,
    hash
  };
};

const verifyPassword = (password, game) => {
  if (!password || typeof password !== 'string' || !game?.hostPasswordHash || !game?.hostPasswordSalt) {
    return false;
  }
  const normalizedPassword = password.trim();
  const computedHash = crypto
    .createHmac('sha256', game.hostPasswordSalt)
    .update(normalizedPassword)
    .digest('hex');
  const storedHashBuffer = Buffer.from(game.hostPasswordHash, 'hex');
  const computedHashBuffer = Buffer.from(computedHash, 'hex');
  if (storedHashBuffer.length !== computedHashBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedHashBuffer, computedHashBuffer);
};

const normalizeGameId = (value) => (value || '').toString().trim().toUpperCase();

const createGameId = () => {
  let gameId;
  do {
    gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (games.has(gameId));
  return gameId;
};

const createGame = ({ password }) => {
  const gameId = createGameId();
  const game = {
    id: gameId,
    hostSocketId: null,
    players: new Map(),
    started: false,
    calledNumbers: [],
    remainingNumbers: Array.from({ length: 75 }, (_, index) => index + 1),
    winner: null,
    hostPasswordHash: password.hash,
    hostPasswordSalt: password.salt
  };
  games.set(gameId, game);
  return game;
};

const ensureHostAuthorized = (socket, game, password) => {
  if (!game) {
    return { ok: false, message: 'Game not found.' };
  }
  if (game.hostSocketId !== socket.id) {
    return { ok: false, message: 'Only host can perform this action.' };
  }
  if (!verifyPassword(password, game)) {
    return { ok: false, message: 'Invalid host password.' };
  }
  return { ok: true };
};

const pushCalledNumber = (game, number) => {
  if (!game.calledNumbers.includes(number)) {
    game.calledNumbers.push(number);
  }
  io.to(roomName(game.id)).emit('game:numberDrawn', {
    number,
    calledNumbers: game.calledNumbers
  });
};

const evaluateWinners = (game) => {
  if (game.winner) {
    return;
  }
  const calledNumbersSet = new Set(game.calledNumbers);
  for (const player of game.players.values()) {
    if (player.board && hasBingo(player.board, calledNumbersSet)) {
      game.winner = player;
      io.to(roomName(game.id)).emit('game:bingo', {
        winner: {
          id: player.id,
          name: player.name
        },
        calledNumbers: game.calledNumbers
      });
      break;
    }
  }
};

const MIN_PLAYERS_TO_START = 1;

app.post('/api/games', (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.trim().length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
    return;
  }

  const passwordRecord = hashPassword(password);
  const game = createGame({ password: passwordRecord });
  res.status(201).json({ gameId: game.id });
});

app.get('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  const game = games.get(normalizeGameId(gameId));
  if (!game) {
    res.status(404).json({ message: 'Game not found.' });
    return;
  }
  res.json({
    gameId: game.id,
    started: game.started,
    playerCount: game.players.size,
    winner: game.winner ? { id: game.winner.id, name: game.winner.name } : null
  });
});

const emitLobbyUpdate = (game) => {
  io.to(roomName(game.id)).emit('game:lobbyUpdate', {
    gameId: game.id,
    players: Array.from(game.players.values()).map((player) => ({
      id: player.id,
      name: player.name
    })),
    started: game.started
  });
};

const roomName = (gameId) => `game:${gameId}`;

const hasBingo = (board, calledNumbersSet) => {
  const size = 5;
  const isMarked = (value, rowIndex, colIndex) => {
    if (rowIndex === 2 && colIndex === 2) {
      return true; // free space
    }
    return calledNumbersSet.has(value);
  };

  for (let row = 0; row < size; row += 1) {
    if (board[row].every((value, col) => isMarked(value, row, col))) {
      return true;
    }
  }

  for (let col = 0; col < size; col += 1) {
    let complete = true;
    for (let row = 0; row < size; row += 1) {
      if (!isMarked(board[row][col], row, col)) {
        complete = false;
        break;
      }
    }
    if (complete) {
      return true;
    }
  }

  if ([0, 1, 2, 3, 4].every((index) => isMarked(board[index][index], index, index))) {
    return true;
  }

  if ([0, 1, 2, 3, 4].every((index) => isMarked(board[index][4 - index], index, 4 - index))) {
    return true;
  }

  return false;
};

const isValidBoard = (board) => {
  if (!Array.isArray(board) || board.length !== 5) {
    return false;
  }
  for (let row = 0; row < 5; row += 1) {
    if (!Array.isArray(board[row]) || board[row].length !== 5) {
      return false;
    }
    for (let col = 0; col < 5; col += 1) {
      const value = board[row][col];
      if (row === 2 && col === 2) {
        if (value !== 'FREE') {
          return false;
        }
        continue;
      }
      if (typeof value !== 'number' || value < 1 || value > 75) {
        return false;
      }
    }
  }
  return true;
};

const drawNumber = (game) => {
  if (game.remainingNumbers.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * game.remainingNumbers.length);
  const [number] = game.remainingNumbers.splice(index, 1);
  return number;
};

const resetGame = (game) => {
  game.started = false;
  game.calledNumbers = [];
  game.remainingNumbers = Array.from({ length: 75 }, (_, index) => index + 1);
  game.winner = null;
  for (const player of game.players.values()) {
    player.board = null;
  }
};

io.on('connection', (socket) => {
  socket.on('host:join', ({ gameId, password }, ack) => {
    const game = games.get(normalizeGameId(gameId));
    if (!game) {
      ack?.({ ok: false, message: 'Game not found.' });
      return;
    }
    if (!verifyPassword(password, game)) {
      ack?.({ ok: false, message: 'Invalid host password.' });
      return;
    }
    game.hostSocketId = socket.id;
    socket.join(roomName(gameId));
    ack?.({ ok: true, gameId });
    emitLobbyUpdate(game);
  });

  socket.on('player:join', ({ gameId, name, board }, ack) => {
    const game = games.get(normalizeGameId(gameId));
    if (!game) {
      ack?.({ ok: false, message: 'Game not found.' });
      return;
    }
    if (game.started) {
      ack?.({ ok: false, message: 'Game already started.' });
      return;
    }
    const player = {
      id: socket.id,
      name: name?.trim() || 'Player',
      board: isValidBoard(board) ? board : null
    };
    game.players.set(socket.id, player);
    socket.join(roomName(gameId));
    ack?.({ ok: true, playerId: socket.id });
    emitLobbyUpdate(game);
  });

  socket.on('player:updateBoard', ({ gameId, board }) => {
    const game = games.get(normalizeGameId(gameId));
    if (!game) {
      return;
    }
    const player = game.players.get(socket.id);
    if (!player || game.started) {
      return;
    }
    if (isValidBoard(board)) {
      player.board = board;
    }
  });

  socket.on('host:start', ({ gameId, password }, ack) => {
    const game = games.get(normalizeGameId(gameId));
    const auth = ensureHostAuthorized(socket, game, password);
    if (!auth.ok) {
      ack?.({ ok: false, message: auth.message });
      return;
    }
    if (game.players.size < MIN_PLAYERS_TO_START) {
      ack?.({ ok: false, message: 'Need at least one player to start.' });
      return;
    }
    game.started = true;
    ack?.({ ok: true });
    io.to(roomName(gameId)).emit('game:started');
  });

  socket.on('host:drawNumber', ({ gameId, password }, ack) => {
    const game = games.get(normalizeGameId(gameId));
    const auth = ensureHostAuthorized(socket, game, password);
    if (!auth.ok) {
      ack?.({ ok: false, message: auth.message });
      return;
    }
    if (!game.started) {
      ack?.({ ok: false, message: 'Game has not started.' });
      return;
    }
    if (game.winner) {
      ack?.({ ok: false, message: 'Game already has a winner.' });
      return;
    }

    const number = drawNumber(game);
    if (!number) {
      ack?.({ ok: false, message: 'All numbers have been drawn.' });
      return;
    }

    pushCalledNumber(game, number);
    evaluateWinners(game);

    ack?.({ ok: true, number });
  });

  socket.on('host:pickNumber', ({ gameId, password, number }, ack) => {
    const game = games.get(normalizeGameId(gameId));
    const auth = ensureHostAuthorized(socket, game, password);
    if (!auth.ok) {
      ack?.({ ok: false, message: auth.message });
      return;
    }
    if (!game.started) {
      ack?.({ ok: false, message: 'Game has not started.' });
      return;
    }
    if (game.winner) {
      ack?.({ ok: false, message: 'Game already has a winner.' });
      return;
    }

    const parsedNumber = Number.parseInt(number, 10);
    if (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > 75) {
      ack?.({ ok: false, message: 'Number must be an integer between 1 and 75.' });
      return;
    }
    if (game.calledNumbers.includes(parsedNumber)) {
      ack?.({ ok: false, message: 'Number has already been called.' });
      return;
    }

    const remainingIndex = game.remainingNumbers.indexOf(parsedNumber);
    if (remainingIndex === -1) {
      ack?.({ ok: false, message: 'Number is not available to pick.' });
      return;
    }

    game.remainingNumbers.splice(remainingIndex, 1);
    pushCalledNumber(game, parsedNumber);
    evaluateWinners(game);

    ack?.({ ok: true, number: parsedNumber });
  });

  socket.on('host:reset', ({ gameId, password }, ack) => {
    const game = games.get(normalizeGameId(gameId));
    const auth = ensureHostAuthorized(socket, game, password);
    if (!auth.ok) {
      ack?.({ ok: false, message: auth.message });
      return;
    }
    resetGame(game);
    ack?.({ ok: true });
    emitLobbyUpdate(game);
    io.to(roomName(gameId)).emit('game:reset');
  });

  socket.on('disconnect', () => {
    for (const [gameId, game] of games.entries()) {
      if (game.hostSocketId === socket.id) {
        io.to(roomName(gameId)).emit('game:ended');
        games.delete(gameId);
        continue;
      }
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        emitLobbyUpdate(game);
        if (!game.started && game.players.size === 0 && !game.hostSocketId) {
          games.delete(gameId);
        }
      }
    }
  });
});

if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
