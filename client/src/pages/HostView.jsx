import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../socket/SocketProvider.jsx';

const PASSWORD_MIN_LENGTH = 4;

const HostView = () => {
  const { gameId } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();

  const basePrefix = useMemo(() => {
    const basePathRaw = import.meta.env.BASE_URL || '/';
    const normalizedBase = basePathRaw.endsWith('/') ? basePathRaw.slice(0, -1) : basePathRaw;
    return normalizedBase && normalizedBase !== '/' ? normalizedBase : '';
  }, []);
  const playerPath = useMemo(() => `${basePrefix}/game/${gameId}`, [basePrefix, gameId]);
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return playerPath;
    }
    return `${window.location.origin}${playerPath}`;
  }, [playerPath]);
  const passwordStorageKey = useMemo(
    () => (gameId ? `hostPassword:${gameId}` : 'hostPassword'),
    [gameId]
  );

  const [players, setPlayers] = useState([]);
  const [started, setStarted] = useState(false);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [winners, setWinners] = useState([]);
  const [maxWinners, setMaxWinners] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [actionError, setActionError] = useState('');
  const [numberRange, setNumberRange] = useState({ min: 1, max: 75 });
  const [drawEstimate, setDrawEstimate] = useState(null);

  const [passwordInput, setPasswordInput] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.sessionStorage.getItem(passwordStorageKey) || '';
  });
  const [activePassword, setActivePassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const hasJoinedRef = useRef(false);
  const initialStoredPasswordRef = useRef(passwordInput || null);

  const attemptJoin = useCallback(
    (rawPassword) => {
      if (!socket) {
        setAuthError('Connecting to the server… please try again in a moment.');
        return;
      }

      const trimmed = (rawPassword ?? '').toString().trim();
      if (trimmed.length < PASSWORD_MIN_LENGTH) {
        setAuthError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
        return;
      }

      setIsAuthenticating(true);
      setAuthError('');
      hasJoinedRef.current = false;

      socket.emit('host:join', { gameId, password: trimmed }, (response) => {
        setIsAuthenticating(false);
        if (!response?.ok) {
          setAuthError(response?.message || 'Unable to authenticate as host.');
          setIsAuthenticated(false);
          setActivePassword('');
          return;
        }

        hasJoinedRef.current = true;
        setIsAuthenticated(true);
        setActivePassword(trimmed);
        setAuthError('');
        setPasswordInput(trimmed);
        if (response.numberRange) {
          setNumberRange(response.numberRange);
        }
        if (typeof response.maxWinners === 'number') {
          setMaxWinners(response.maxWinners);
        }
        if (Array.isArray(response.winners)) {
          setWinners(response.winners);
        }
        if ('drawEstimate' in response) {
          setDrawEstimate(response.drawEstimate);
        }
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(passwordStorageKey, trimmed);
        }
      });
    },
    [socket, gameId, passwordStorageKey]
  );

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleLobbyUpdate = (payload) => {
      if (payload.gameId !== gameId) {
        return;
      }
      setPlayers(payload.players);
      setStarted(payload.started);
      if (payload.numberRange) {
        setNumberRange(payload.numberRange);
      }
      if (typeof payload.maxWinners === 'number') {
        setMaxWinners(payload.maxWinners);
      }
      if (Array.isArray(payload.winners)) {
        setWinners(payload.winners);
      }
      if ('drawEstimate' in payload) {
        setDrawEstimate(payload.drawEstimate);
      }
    };

    const handleGameStarted = () => {
      setStarted(true);
      setCalledNumbers([]);
      setWinners([]);
      setManualNumber('');
      setIsDrawing(false);
      setIsPicking(false);
      setDrawEstimate(null);
    };

    const handleNumberDrawn = ({ calledNumbers: numbers }) => {
      setCalledNumbers(numbers);
      setIsDrawing(false);
      setIsPicking(false);
      setActionError('');
    };

    const handleBingo = ({ winners: winnerList, newWinners, calledNumbers: numbers, maxWinners: limit }) => {
      if (Array.isArray(winnerList)) {
        setWinners(winnerList);
      }
      if (typeof limit === 'number') {
        setMaxWinners(limit);
      }
      setCalledNumbers(numbers);
      setIsDrawing(false);
      setIsPicking(false);
      const limitReached = Array.isArray(winnerList) && typeof limit === 'number' && winnerList.length >= limit;
      setActionError(limitReached ? 'Winner limit reached. Reset to start a new round.' : '');
    };

    const handleReset = () => {
      setStarted(false);
      setCalledNumbers([]);
      setWinners([]);
      setManualNumber('');
      setIsDrawing(false);
      setIsPicking(false);
      setActionError('');
      setDrawEstimate(null);
    };

    const handleEnded = () => {
      setActionError('Game ended because the host disconnected.');
      setIsAuthenticated(false);
      setActivePassword('');
      setWinners([]);
      setDrawEstimate(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(passwordStorageKey);
      }
      navigate('/', { replace: true });
    };

    socket.on('game:lobbyUpdate', handleLobbyUpdate);
    socket.on('game:started', handleGameStarted);
    socket.on('game:numberDrawn', handleNumberDrawn);
    socket.on('game:bingo', handleBingo);
    socket.on('game:reset', handleReset);
    socket.on('game:ended', handleEnded);

    return () => {
      socket.off('game:lobbyUpdate', handleLobbyUpdate);
      socket.off('game:started', handleGameStarted);
      socket.off('game:numberDrawn', handleNumberDrawn);
      socket.off('game:bingo', handleBingo);
      socket.off('game:reset', handleReset);
      socket.off('game:ended', handleEnded);
    };
  }, [socket, gameId, navigate, passwordStorageKey]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    if (!initialStoredPasswordRef.current) {
      return;
    }
    const stored = initialStoredPasswordRef.current;
    initialStoredPasswordRef.current = null;
    if (stored) {
      attemptJoin(stored);
    }
  }, [socket, attemptJoin]);

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    attemptJoin(passwordInput);
  };

  const requirePassword = useCallback(() => {
    if (!isAuthenticated || !activePassword) {
      setActionError('Unlock host controls with your password first.');
      return false;
    }
    return true;
  }, [isAuthenticated, activePassword]);

  const handleStartGame = () => {
    if (!socket || !requirePassword()) {
      return;
    }
    setActionError('');
    socket.emit('host:start', { gameId, password: activePassword }, (response) => {
      if (!response?.ok) {
        setActionError(response?.message || 'Unable to start game.');
      }
    });
  };

  const handleDrawNumber = () => {
    if (!socket || !requirePassword()) {
      return;
    }
    setActionError('');
    setIsDrawing(true);
    socket.emit('host:drawNumber', { gameId, password: activePassword }, (response) => {
      if (!response?.ok) {
        setActionError(response?.message || 'Unable to draw number.');
        setIsDrawing(false);
      }
    });
  };

  const handleManualPick = (event) => {
    event.preventDefault();
    if (!socket || !requirePassword()) {
      return;
    }
    const trimmed = manualNumber.trim();
    const parsed = Number.parseInt(trimmed, 10);
    if (
      !Number.isInteger(parsed) ||
      parsed < numberRange.min ||
      parsed > numberRange.max
    ) {
      setActionError(`Enter a whole number between ${numberRange.min} and ${numberRange.max}.`);
      return;
    }
    setActionError('');
    setIsPicking(true);
    socket.emit(
      'host:pickNumber',
      { gameId, password: activePassword, number: parsed },
      (response) => {
        if (!response?.ok) {
          setActionError(response?.message || 'Unable to pick number.');
          setIsPicking(false);
          return;
        }
        setManualNumber('');
        setIsPicking(false);
      }
    );
  };

  const handleResetGame = () => {
    if (!socket || !requirePassword()) {
      return;
    }
    setActionError('');
    socket.emit('host:reset', { gameId, password: activePassword }, (response) => {
      if (!response?.ok) {
        setActionError(response?.message || 'Unable to reset game.');
        return;
      }
      setManualNumber('');
      setIsDrawing(false);
      setIsPicking(false);
    });
  };

  return (
    <div className="card">
      <h1>Host Control Center</h1>
      <p>
        Share this link with your players:
        <br />
        <strong>{shareUrl}</strong>
      </p>
      <p>
        Or send them directly to <Link to={`/game/${gameId}`}>{playerPath}</Link>
      </p>
      <p style={{ marginTop: '0.5rem', color: '#475569' }}>
        Number range: {numberRange.min} – {numberRange.max}
        <br />Winner limit: {maxWinners}
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Host Access</h2>
        <form
          onSubmit={handlePasswordSubmit}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Enter host password"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5f5',
              minWidth: '240px',
              fontSize: '1rem'
            }}
          />
          <button type="submit" disabled={isAuthenticating}>
            {isAuthenticating ? 'Unlocking…' : isAuthenticated ? 'Re-authenticate' : 'Unlock Controls'}
          </button>
        </form>
        {authError ? <p style={{ marginTop: '0.75rem', color: '#dc2626' }}>{authError}</p> : null}
        {isAuthenticated ? (
          <p style={{ marginTop: '0.75rem', color: '#16a34a' }}>Controls unlocked.</p>
        ) : (
          <p style={{ marginTop: '0.75rem', color: '#475569' }}>
            Enter the password you set when creating this game to unlock host controls.
          </p>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Lobby</h2>
        <p>{players.length === 0 ? 'Waiting for players to join…' : `${players.length} player(s) ready`}</p>
        {drawEstimate ? (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              background: '#eef2ff',
              borderRadius: '8px',
              color: '#312e81',
              lineHeight: 1.5
            }}
          >
            <strong>Estimated draws to first Bingo:</strong> ~{drawEstimate.average}{' '}
            {drawEstimate.p10 && drawEstimate.p90
              ? `(likely range ${drawEstimate.p10}–${drawEstimate.p90})`
              : null}
            {drawEstimate.median ? (
              <>
                <br />Typical draw count (median): {drawEstimate.median}
              </>
            ) : null}
            <br />
            Based on {players.length} player{players.length === 1 ? '' : 's'} and numbers {numberRange.min}–
            {numberRange.max} (sample size {drawEstimate.sampleSize}).
          </div>
        ) : null}
        <ul>
          {players.map((player) => (
            <li key={player.id}>{player.name}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleStartGame}
          disabled={!isAuthenticated || started || players.length === 0}
        >
          Start Game
        </button>
      </section>

      {started ? (
        <section style={{ marginTop: '2rem' }}>
          <h2>Active Game</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '420px' }}>
            <button
              type="button"
              onClick={handleDrawNumber}
              disabled={!isAuthenticated || isDrawing || winners.length >= maxWinners}
            >
              {isDrawing ? 'Drawing…' : 'Draw Next Number'}
            </button>
            <form onSubmit={handleManualPick} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="number"
                min={numberRange.min}
                max={numberRange.max}
                value={manualNumber}
                onChange={(event) => setManualNumber(event.target.value)}
                placeholder="Pick a specific number"
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5f5',
                  flex: '1 1 auto'
                }}
                disabled={!isAuthenticated || winners.length >= maxWinners}
              />
              <button type="submit" disabled={!isAuthenticated || isPicking || winners.length >= maxWinners}>
                {isPicking ? 'Sending…' : 'Call Number'}
              </button>
            </form>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Called Numbers</h3>
            {calledNumbers.length ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
                  gap: '0.5rem'
                }}
              >
                {calledNumbers.map((number) => (
                  <div
                    key={number}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: '#e0f2fe',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: '#0f172a'
                    }}
                  >
                    {number}
                  </div>
                ))}
              </div>
            ) : (
              <p>No numbers drawn yet.</p>
            )}
          </div>
        </section>
      ) : null}

      {winners.length > 0 ? (
        <section style={{ marginTop: '2rem' }}>
          <h2>🎉 Bingo Winners</h2>
          <p style={{ marginBottom: '0.75rem' }}>
            {winners.length} of {maxWinners} winner{maxWinners === 1 ? '' : 's'} confirmed.
          </p>
          <ul style={{ marginBottom: '1rem' }}>
            {winners.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.name}</strong>
              </li>
            ))}
          </ul>
          {winners.length >= maxWinners ? (
            <p style={{ color: '#16a34a', marginBottom: '1rem' }}>
              Winner limit reached! Reset to start a new round.
            </p>
          ) : (
            <p style={{ color: '#475569', marginBottom: '1rem' }}>
              Keep drawing numbers to award the remaining winner spot{maxWinners - winners.length === 1 ? '' : 's'}.
            </p>
          )}
          <button type="button" onClick={handleResetGame} disabled={!isAuthenticated}>
            Play Again
          </button>
        </section>
      ) : null}

      {actionError ? <p style={{ marginTop: '1.5rem', color: '#dc2626' }}>{actionError}</p> : null}
    </div>
  );
};

export default HostView;
