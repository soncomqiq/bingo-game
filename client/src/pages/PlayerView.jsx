import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import BingoBoard from '../components/BingoBoard.jsx';
import { generateBingoBoard, getDefaultNumberRange } from '../utils/bingo.js';
import { apiFetch } from '../utils/apiClient.js';
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
  const [winners, setWinners] = useState([]);
  const [maxWinners, setMaxWinners] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [numberRange, setNumberRange] = useState(getDefaultNumberRange());

  const sortedCalledNumbers = useMemo(() => [...calledNumbers].sort((a, b) => a - b), [calledNumbers]);

  useEffect(() => {
    let isMounted = true;
    const fetchGame = async () => {
      setLoading(true);
      try {
  const response = await apiFetch(`/api/games/${gameId}`);
        if (response.status === 404) {
          throw new Error('Game not found. Double-check the link with your host.');
        }
        const data = await response.json();
        if (!isMounted) {
          return;
        }
        if (data.numberRange) {
          setNumberRange(data.numberRange);
        }
        if (Array.isArray(data.winners)) {
          setWinners(data.winners);
        }
        if (typeof data.maxWinners === 'number') {
          setMaxWinners(data.maxWinners);
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
      setWinners([]);
    };

    const handleNumberDrawn = ({ number, calledNumbers: numbers }) => {
      setCalledNumbers(numbers);
      setStatusMessage(`Number ${number} was just called!`);
    };

    const handleBingo = ({ winners: winnerList, newWinners, calledNumbers: numbers, maxWinners: limit }) => {
      if (Array.isArray(winnerList)) {
        setWinners(winnerList);
      }
      if (typeof limit === 'number') {
        setMaxWinners(limit);
      }
      setCalledNumbers(numbers);
      if (Array.isArray(newWinners) && newWinners.length) {
        const names = newWinners
          .map((entry) => (entry.id === playerId ? 'You' : entry.name))
          .join(', ');
        setStatusMessage(`${names} ${newWinners.length === 1 ? 'has' : 'have'} BINGO!`);
      } else if (Array.isArray(winnerList) && winnerList.length) {
        const youAreWinner = winnerList.some((entry) => entry.id === playerId);
        setStatusMessage(
          youAreWinner
            ? 'You already have BINGO!'
            : `We have ${winnerList.length} winner${winnerList.length === 1 ? '' : 's'} so far!`
        );
      }
    };

    const handleReset = () => {
      setGameStarted(false);
      setCalledNumbers([]);
      const freshBoard = generateBingoBoard(numberRange);
      setBoard(freshBoard);
      if (socket && playerId) {
        socket.emit('player:updateBoard', { gameId, board: freshBoard });
      }
      setStatusMessage('Host is setting up a new round. A fresh board has been prepared for you.');
      setWinners([]);
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
  }, [socket, hasJoined, gameId, playerId, numberRange]);

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
    const boardForJoin = generateBingoBoard(numberRange);
    socket.emit(
      'player:join',
      {
        gameId,
        name: name.trim(),
        board: boardForJoin
      },
      (response) => {
        if (!response?.ok) {
          setError(response?.message || 'Unable to join game.');
          setIsSubmitting(false);
          return;
        }
        if (response.numberRange) {
          setNumberRange(response.numberRange);
        }
        if (typeof response.maxWinners === 'number') {
          setMaxWinners(response.maxWinners);
        }
        if (Array.isArray(response.winners)) {
          setWinners(response.winners);
        }
        if (response.numberRange && (response.numberRange.min !== numberRange.min || response.numberRange.max !== numberRange.max)) {
          const adjustedBoard = generateBingoBoard(response.numberRange);
          setBoard(adjustedBoard);
          socket.emit('player:updateBoard', { gameId, board: adjustedBoard });
        } else {
          setBoard(boardForJoin);
        }
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
    const newBoard = generateBingoBoard(numberRange);
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
          <p style={{ marginTop: '1rem', color: '#475569' }}>
            Number range: {numberRange.min} – {numberRange.max}
            <br />Winner limit: {maxWinners}
          </p>
          <BingoBoard board={board} calledNumbers={calledNumbers} />
          {!gameStarted ? (
            <button type="button" style={{ marginTop: '1.5rem' }} onClick={handleRandomizeBoard}>
              Randomize Board
            </button>
          ) : null}
          {winners.length > 0 ? (
            <section style={{ marginTop: '1.5rem' }}>
              <h3>Current Winners</h3>
              <ul>
                {winners.map((entry) => (
                  <li key={entry.id} style={{ fontWeight: entry.id === playerId ? 700 : 500 }}>
                    {entry.id === playerId ? 'You' : entry.name}
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: '0.5rem', color: '#475569' }}>
                {winners.length} of {maxWinners} winner{maxWinners === 1 ? '' : 's'} confirmed.
                {winners.length >= maxWinners
                  ? ' Winner limit reached—hang tight for the next round.'
                  : ` ${maxWinners - winners.length} spot${maxWinners - winners.length === 1 ? '' : 's'} remaining.`}
              </p>
            </section>
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
