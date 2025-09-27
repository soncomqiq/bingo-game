const COLUMN_RANGES = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75]
];

const getRandomUniqueNumbers = (count, min, max) => {
  const numbers = [];
  while (numbers.length < count) {
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numbers.includes(value)) {
      numbers.push(value);
    }
  }
  return numbers;
};

export const generateBingoBoard = () => {
  const columns = COLUMN_RANGES.map(([min, max], index) => {
    const count = 5;
    const numbers = getRandomUniqueNumbers(count, min, max);
    numbers.sort((a, b) => a - b);
    return numbers;
  });

  const board = Array.from({ length: 5 }, (_, rowIndex) =>
    columns.map((colNumbers, colIndex) => {
      if (rowIndex === 2 && colIndex === 2) {
        return 'FREE';
      }
      return colNumbers[rowIndex];
    })
  );

  return board;
};

export const isCellMarked = (value, rowIndex, colIndex, calledNumbersSet) => {
  if (rowIndex === 2 && colIndex === 2) {
    return true;
  }
  return calledNumbersSet.has(value);
};
