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
const DEFAULT_NUMBER_RANGE = { min: 1, max: 75 };
const MIN_ALLOWED_NUMBER = 1;
const MAX_ALLOWED_NUMBER = 200;
const BOARD_SIZE = 5;
const REQUIRED_UNIQUE_NUMBERS = BOARD_SIZE * BOARD_SIZE - 1; // minus free space
const DEFAULT_SIMULATION_TRIALS = 150;
const MAX_SIMULATION_TRIALS = 500;
const MIN_SIMULATION_TRIALS = 40;
const DEFAULT_MAX_WINNERS = 1;
const MIN_MAX_WINNERS = 1;
const MAX_MAX_WINNERS = 10;

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

const parseRangeValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed);
};

const normalizeNumberRange = (inputRange = {}) => {
  const rawMin = parseRangeValue(inputRange.min);
  const rawMax = parseRangeValue(inputRange.max);

  const min = rawMin !== undefined ? rawMin : DEFAULT_NUMBER_RANGE.min;
  const max = rawMax !== undefined ? rawMax : DEFAULT_NUMBER_RANGE.max;

  if (min < MIN_ALLOWED_NUMBER) {
    throw new Error(`Minimum number must be at least ${MIN_ALLOWED_NUMBER}.`);
  }
  if (max > MAX_ALLOWED_NUMBER) {
    throw new Error(`Maximum number must not exceed ${MAX_ALLOWED_NUMBER}.`);
  }
  if (min >= max) {
    throw new Error('Minimum number must be smaller than maximum number.');
  }

  const span = max - min + 1;
  if (span < REQUIRED_UNIQUE_NUMBERS) {
    throw new Error(`Number range must contain at least ${REQUIRED_UNIQUE_NUMBERS} unique numbers.`);
  }

  return { min, max };
};

const normalizeMaxWinners = (inputValue) => {
  const parsed = parseRangeValue(inputValue);
  if (parsed === undefined) {
    return DEFAULT_MAX_WINNERS;
  }
  if (parsed < MIN_MAX_WINNERS) {
    throw new Error(`Winner limit must be at least ${MIN_MAX_WINNERS}.`);
  }
  if (parsed > MAX_MAX_WINNERS) {
    throw new Error(`Winner limit cannot exceed ${MAX_MAX_WINNERS}.`);
  }
  return parsed;
};

const createNumberPool = ({ min, max }) => {
  const pool = [];
  for (let value = min; value <= max; value += 1) {
    pool.push(value);
  }
  return pool;
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

const generateSimulatedBoard = (numberRange) => {
  const pool = createNumberPool(numberRange);
  if (pool.length < REQUIRED_UNIQUE_NUMBERS) {
    throw new Error('Number range is too small to simulate bingo boards.');
  }
  shuffleArray(pool);
  const board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
  let index = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (row === Math.floor(BOARD_SIZE / 2) && col === Math.floor(BOARD_SIZE / 2)) {
        board[row][col] = 'FREE';
        continue;
      }
      board[row][col] = pool[index];
      index += 1;
    }
  }
  return board;
};

const percentileFromSorted = (sortedValues, percentile) => {
  if (!sortedValues.length) {
    return null;
  }
  const clamped = Math.min(Math.max(percentile, 0), 1);
  const index = Math.round((sortedValues.length - 1) * clamped);
  return sortedValues[index];
};

const summarizeDrawCounts = (drawCounts) => {
  if (!drawCounts.length) {
    return null;
  }
  const total = drawCounts.reduce((sum, value) => sum + value, 0);
  const average = total / drawCounts.length;
  const sorted = [...drawCounts].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const median = sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[Math.floor(mid)];
  return {
    average: Number(average.toFixed(1)),
    median,
    p10: percentileFromSorted(sorted, 0.1),
    p90: percentileFromSorted(sorted, 0.9),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sampleSize: drawCounts.length
  };
};

const estimateDrawsToBingo = ({ numberRange, playerCount }) => {
  if (!numberRange || playerCount <= 0) {
    return null;
  }

  const { min, max } = numberRange;
  if (min >= max) {
    return null;
  }

  const rangeSize = max - min + 1;
  if (rangeSize < REQUIRED_UNIQUE_NUMBERS) {
    return null;
  }

  const dynamicTrials = Math.min(
    MAX_SIMULATION_TRIALS,
    Math.max(DEFAULT_SIMULATION_TRIALS, MIN_SIMULATION_TRIALS + playerCount * 10)
  );

  const drawCounts = [];
  for (let trial = 0; trial < dynamicTrials; trial += 1) {
    const boards = Array.from({ length: playerCount }, () => generateSimulatedBoard(numberRange));
    const deck = createNumberPool(numberRange);
    shuffleArray(deck);
    const calledNumbersSet = new Set();
    let draws = 0;
    let winnerFound = false;

    for (const number of deck) {
      draws += 1;
      calledNumbersSet.add(number);
      for (const board of boards) {
        if (hasBingo(board, calledNumbersSet)) {
          winnerFound = true;
          break;
        }
      }
      if (winnerFound) {
        break;
      }
    }

    drawCounts.push(draws);
  }

  return summarizeDrawCounts(drawCounts);
};

const calculateDrawEstimateForGame = (game) => {
  try {
    return estimateDrawsToBingo({ numberRange: game.numberRange, playerCount: game.players.size });
  } catch (error) {
    console.error('Failed to calculate draw estimate:', error.message);
    return null;
  }
};

const normalizeGameId = (value) => (value || '').toString().trim().toUpperCase();

const createGameId = () => {
  let gameId;
  do {
    gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (games.has(gameId));
  return gameId;
};

const createGame = ({ password, numberRange, maxWinners }) => {
  const gameId = createGameId();
  const game = {
    id: gameId,
    hostSocketId: null,
    players: new Map(),
    started: false,
    calledNumbers: [],
    numberRange,
    remainingNumbers: createNumberPool(numberRange),
    winners: [],
    maxWinners,
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
  if (game.winners.length >= game.maxWinners) {
    return [];
  }
  const calledNumbersSet = new Set(game.calledNumbers);
  const newWinners = [];

  for (const player of game.players.values()) {
    if (!player.board) {
      continue;
    }
    const isAlreadyWinner = game.winners.some((existing) => existing.id === player.id);
    if (isAlreadyWinner) {
      continue;
    }
    if (hasBingo(player.board, calledNumbersSet)) {
      const winnerRecord = {
        id: player.id,
        name: player.name
      };
      game.winners.push(winnerRecord);
      newWinners.push(winnerRecord);
      if (game.winners.length >= game.maxWinners) {
        break;
      }
    }
  }

  if (newWinners.length > 0) {
    io.to(roomName(game.id)).emit('game:bingo', {
      winners: game.winners,
      newWinners,
      calledNumbers: game.calledNumbers,
      maxWinners: game.maxWinners
    });
  }

  return newWinners;
};

const MIN_PLAYERS_TO_START = 1;

app.post('/api/games', (req, res) => {
  const { password, numberRange, maxWinners } = req.body || {};
  if (typeof password !== 'string' || password.trim().length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
    return;
  }

  try {
    const normalizedRange = normalizeNumberRange(numberRange);
    const normalizedMaxWinners = normalizeMaxWinners(maxWinners);
    const passwordRecord = hashPassword(password);
    const game = createGame({ password: passwordRecord, numberRange: normalizedRange, maxWinners: normalizedMaxWinners });
    res.status(201).json({ gameId: game.id });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to create game.' });
  }
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
    numberRange: game.numberRange,
    winners: game.winners,
    maxWinners: game.maxWinners,
    drawEstimate: calculateDrawEstimateForGame(game)
  });
});

const emitLobbyUpdate = (game) => {
  io.to(roomName(game.id)).emit('game:lobbyUpdate', {
    gameId: game.id,
    players: Array.from(game.players.values()).map((player) => ({
      id: player.id,
      name: player.name
    })),
    started: game.started,
    numberRange: game.numberRange,
    drawEstimate: calculateDrawEstimateForGame(game),
    winners: game.winners,
    maxWinners: game.maxWinners
  });
};

const roomName = (gameId) => `game:${gameId}`;

const hasBingo = (board, calledNumbersSet) => {
  const size = BOARD_SIZE;
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

const isValidBoard = (board, numberRange) => {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) {
    return false;
  }
  if (!numberRange) {
    return false;
  }

  const seen = new Set();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (!Array.isArray(board[row]) || board[row].length !== BOARD_SIZE) {
      return false;
    }
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = board[row][col];
      if (row === Math.floor(BOARD_SIZE / 2) && col === Math.floor(BOARD_SIZE / 2)) {
        if (value !== 'FREE') {
          return false;
        }
        continue;
      }
      if (!Number.isInteger(value)) {
        return false;
      }
      if (value < numberRange.min || value > numberRange.max) {
        return false;
      }
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
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
  game.remainingNumbers = createNumberPool(game.numberRange);
  game.winners = [];
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
    ack?.({
      ok: true,
      gameId,
      numberRange: game.numberRange,
      drawEstimate: calculateDrawEstimateForGame(game),
      winners: game.winners,
      maxWinners: game.maxWinners
    });
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
      board: isValidBoard(board, game.numberRange) ? board : null
    };
    game.players.set(socket.id, player);
    socket.join(roomName(gameId));
    ack?.({
      ok: true,
      playerId: socket.id,
      numberRange: game.numberRange,
      drawEstimate: calculateDrawEstimateForGame(game),
      maxWinners: game.maxWinners,
      winners: game.winners
    });
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
    if (isValidBoard(board, game.numberRange)) {
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
    if (game.winners.length >= game.maxWinners) {
      ack?.({ ok: false, message: 'Winner limit reached.' });
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
    if (game.winners.length >= game.maxWinners) {
      ack?.({ ok: false, message: 'Winner limit reached.' });
      return;
    }

    const parsedNumber = Number.parseInt(number, 10);
    if (
      !Number.isInteger(parsedNumber) ||
      parsedNumber < game.numberRange.min ||
      parsedNumber > game.numberRange.max
    ) {
      ack?.({
        ok: false,
        message: `Number must be an integer between ${game.numberRange.min} and ${game.numberRange.max}.`
      });
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
