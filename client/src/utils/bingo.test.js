import { describe, expect, it } from 'vitest';
import { generateBingoBoard, isCellMarked } from './bingo.js';

describe('generateBingoBoard', () => {
  it('creates a 5x5 board with a FREE center space', () => {
    const board = generateBingoBoard();
    expect(board).toHaveLength(5);
    board.forEach((row) => expect(row).toHaveLength(5));
    expect(board[2][2]).toBe('FREE');
  });

  it('fills each column with numbers from the correct ranges', () => {
    const board = generateBingoBoard();
    const ranges = [
      [1, 15],
      [16, 30],
      [31, 45],
      [46, 60],
      [61, 75]
    ];

    board.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (rowIndex === 2 && colIndex === 2) {
          expect(value).toBe('FREE');
          return;
        }
        const [min, max] = ranges[colIndex];
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
      });
    });
  });

  it('does not repeat numbers within the same column', () => {
    const board = generateBingoBoard();
    for (let col = 0; col < 5; col += 1) {
      const columnValues = new Set();
      for (let row = 0; row < 5; row += 1) {
        if (row === 2 && col === 2) {
          continue;
        }
        const value = board[row][col];
        expect(columnValues.has(value)).toBe(false);
        columnValues.add(value);
      }
    }
  });
});

describe('isCellMarked', () => {
  it('treats center cell as always marked', () => {
    const set = new Set();
    expect(isCellMarked('FREE', 2, 2, set)).toBe(true);
  });

  it('marks numbers present in the called set and leaves others unmarked', () => {
    const called = new Set([5, 10, 42]);
    expect(isCellMarked(10, 0, 1, called)).toBe(true);
    expect(isCellMarked(11, 0, 1, called)).toBe(false);
  });
});
