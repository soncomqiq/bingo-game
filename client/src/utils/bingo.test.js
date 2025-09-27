import { describe, expect, it } from 'vitest';
import { generateBingoBoard, isCellMarked } from './bingo.js';

describe('generateBingoBoard', () => {
  it('creates a 5x5 board with a FREE center space', () => {
    const board = generateBingoBoard();
    expect(board).toHaveLength(5);
    board.forEach((row) => expect(row).toHaveLength(5));
    expect(board[2][2]).toBe('FREE');
  });

  it('fills the board with unique numbers in the default range', () => {
    const board = generateBingoBoard();
    const seen = new Set();

    board.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (rowIndex === 2 && colIndex === 2) {
          expect(value).toBe('FREE');
          return;
        }
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(75);
        expect(seen.has(value)).toBe(false);
        seen.add(value);
      });
    });

    expect(seen.size).toBe(24);
  });

  it('respects a custom number range', () => {
    const board = generateBingoBoard({ min: 10, max: 60 });
    board.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (rowIndex === 2 && colIndex === 2) {
          return;
        }
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(60);
      });
    });
  });

  it('throws if the range cannot supply 24 unique numbers', () => {
    expect(() => generateBingoBoard({ min: 1, max: 10 })).toThrow(
      /too small to generate a unique bingo board/i
    );
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
