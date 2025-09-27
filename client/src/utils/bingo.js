const BOARD_SIZE = 5;
const FREE_SPACE_VALUE = 'FREE';

const DEFAULT_NUMBER_RANGE = { min: 1, max: 75 };

const createRangePool = ({ min, max }) => {
  const pool = [];
  for (let value = min; value <= max; value += 1) {
    pool.push(value);
  }
  return pool;
};

const sampleUniqueNumbers = (count, range) => {
  const pool = createRangePool(range);
  if (count > pool.length) {
    throw new Error('Number range is too small to generate a unique bingo board.');
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
};

export const generateBingoBoard = (range = DEFAULT_NUMBER_RANGE) => {
  const requiredNumbers = BOARD_SIZE * BOARD_SIZE - 1;
  const uniqueNumbers = sampleUniqueNumbers(requiredNumbers, range);

  const board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
  let index = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (row === Math.floor(BOARD_SIZE / 2) && col === Math.floor(BOARD_SIZE / 2)) {
        board[row][col] = FREE_SPACE_VALUE;
        continue;
      }
      board[row][col] = uniqueNumbers[index];
      index += 1;
    }
  }

  return board;
};

export const isCellMarked = (value, rowIndex, colIndex, calledNumbersSet) => {
  if (rowIndex === Math.floor(BOARD_SIZE / 2) && colIndex === Math.floor(BOARD_SIZE / 2)) {
    return true;
  }
  return calledNumbersSet.has(value);
};

export const getDefaultNumberRange = () => ({ ...DEFAULT_NUMBER_RANGE });
