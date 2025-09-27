import { useMemo } from 'react';
import { isCellMarked } from '../utils/bingo.js';

const BingoBoard = ({ board, calledNumbers }) => {
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);

  if (!board) {
    return null;
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.5rem',
          marginBottom: '0.75rem'
        }}
      >
        {'BINGO'.split('').map((letter) => (
          <div
            key={letter}
            style={{
              textAlign: 'center',
              fontWeight: 700,
              color: '#1d4ed8',
              fontSize: '1.1rem'
            }}
          >
            {letter}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.5rem'
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            const marked = isCellMarked(value, rowIndex, colIndex, calledSet);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                style={{
                  padding: '1.1rem 0.5rem',
                  borderRadius: '10px',
                  textAlign: 'center',
                  background: marked ? '#34d399' : '#e2e8f0',
                  color: marked ? '#0f172a' : '#1f2937',
                  fontWeight: marked ? 700 : 500,
                  boxShadow: marked ? '0 6px 16px rgba(16, 185, 129, 0.35)' : 'inset 0 2px 4px rgba(15,23,42,0.08)'
                }}
              >
                {value === 'FREE' ? 'FREE' : value}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BingoBoard;
