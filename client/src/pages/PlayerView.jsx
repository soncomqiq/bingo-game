import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import BingoBoard from '../components/BingoBoard.jsx';
import { generateBingoBoard } from '../utils/bingo.js';
import { useSocket } from '../socket/SocketProvider.jsx';

const PlayerView = () => {
  const { gameId } = useParams();
  const socket = useSocket();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [board, setBoard] = useState(null);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [winner, setWinner] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playerId, setPlayerId] = useState(null);

  const sortedCalledNumbers = useMemo(() => [...calledNumbers].sort((a, b) => a - b), [calledNumbers]);

  useEffect(() => {
    let isMounted = true;
    const fetchGame = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (response.status === 404) {
          throw new Error('Game not found. Double-check the link with your host.');
        }
        const data = await response.json();
        if (!isMounted) {
          return;
        }
        if (data.started) {
          setError('This game has already started. Wait for the next round.');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load game details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchGame();
    return () => {
      isMounted = false;
    };
  }, [gameId]);

  useEffect(() => {
    if (!socket || !hasJoined) {
      return;
    }

    const handleGameStarted = () => {
      setGameStarted(true);
      setStatusMessage('Game is live! Numbers will appear here as they are drawn.');
    };

    const handleNumberDrawn = ({ number, calledNumbers: numbers }) => {
      setCalledNumbers(numbers);
      setStatusMessage(`Number ${number} was just called!`);
      setWinner(null);
    };

    const handleBingo = ({ winner: winnerPlayer, calledNumbers: numbers }) => {
      setWinner(winnerPlayer);
      setCalledNumbers(numbers);
      setStatusMessage(`Player ${winnerPlayer.name} has BINGO!`);
    };

    const handleReset = () => {
      setGameStarted(false);
      setCalledNumbers([]);
      const freshBoard = generateBingoBoard();
      setBoard(freshBoard);
      if (socket && playerId) {
        socket.emit('player:updateBoard', { gameId, board: freshBoard });
      }
      setStatusMessage('Host is setting up a new round. A fresh board has been prepared for you.');
      setWinner(null);
    };

    const handleEnded = () => {
      setStatusMessage('Game ended by host.');
      setGameStarted(false);
    };

    socket.on('game:started', handleGameStarted);
    socket.on('game:numberDrawn', handleNumberDrawn);
    socket.on('game:bingo', handleBingo);
    socket.on('game:reset', handleReset);
    socket.on('game:ended', handleEnded);

    return () => {
      socket.off('game:started', handleGameStarted);
      socket.off('game:numberDrawn', handleNumberDrawn);
      socket.off('game:bingo', handleBingo);
      socket.off('game:reset', handleReset);
      socket.off('game:ended', handleEnded);
    };
  }, [socket, hasJoined, gameId, playerId]);

  const handleJoinGame = (event) => {
    event.preventDefault();
    if (!socket) {
      setError('Connecting… please try again in a moment.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name to join.');
      return;
    }
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    const newBoard = generateBingoBoard();
    socket.emit(
      'player:join',
      {
        gameId,
        name: name.trim(),
        board: newBoard
      },
      (response) => {
        if (!response?.ok) {
          setError(response?.message || 'Unable to join game.');
          setIsSubmitting(false);
          return;
        }
        setBoard(newBoard);
        setCalledNumbers([]);
        setPlayerId(response.playerId);
        setHasJoined(true);
        setStatusMessage('Welcome! You can randomize your board until the host starts the game.');
        setIsSubmitting(false);
      }
    );
  };

  const handleRandomizeBoard = () => {
    if (gameStarted) {
      return;
    }
    const newBoard = generateBingoBoard();
    setBoard(newBoard);
    if (socket && playerId) {
      socket.emit('player:updateBoard', { gameId, board: newBoard });
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p>Loading game lobby…</p>
      </div>
    );
  }

  if (error && !hasJoined) {
    return (
      <div className="card">
        <p style={{ color: '#dc2626' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Player Lobby</h1>
      {!hasJoined ? (
        <form onSubmit={handleJoinGame} style={{ marginTop: '1.5rem' }}>
          <label htmlFor="playerName" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Enter your name to join the game
          </label>
          <input
            id="playerName"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5f5',
              width: '100%',
              maxWidth: '360px',
              fontSize: '1rem'
            }}
          />
          <button
            type="submit"
            style={{ marginTop: '1rem' }}
            disabled={isSubmitting || !socket}
          >
            {isSubmitting ? 'Joining…' : 'Join Game'}
          </button>
        </form>
      ) : (
        <div>
          {statusMessage ? (
            <p style={{ marginTop: '0.5rem', color: '#0f172a' }}>{statusMessage}</p>
          ) : null}
          <BingoBoard board={board} calledNumbers={calledNumbers} />
          {!gameStarted ? (
            <button type="button" style={{ marginTop: '1.5rem' }} onClick={handleRandomizeBoard}>
              Randomize Board
            </button>
          ) : null}
          {winner ? (
            <p style={{ marginTop: '1.5rem', fontWeight: 600 }}>
              {winner.id === playerId
                ? 'Congratulations! You got BINGO!'
                : `${winner.name} has declared BINGO.`}
            </p>
          ) : null}

          {sortedCalledNumbers.length ? (
            <section style={{ marginTop: '2rem' }}>
              <h3>Numbers Called So Far</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
                  gap: '0.5rem'
                }}
              >
                {sortedCalledNumbers.map((number) => (
                  <div
                    key={number}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      background: '#dbeafe',
                      textAlign: 'center',
                      fontWeight: 600
                    }}
                  >
                    {number}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {error && hasJoined ? <p style={{ marginTop: '1.5rem', color: '#dc2626' }}>{error}</p> : null}
    </div>
  );
};

export default PlayerView;
