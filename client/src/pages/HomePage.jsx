import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PASSWORD_MIN_LENGTH = 4;

const HomePage = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [minNumber, setMinNumber] = useState(1);
  const [maxNumber, setMaxNumber] = useState(75);
  const [maxWinners, setMaxWinners] = useState(1);
  const navigate = useNavigate();

  const handleCreateGame = async (event) => {
    event.preventDefault();
    if (isCreating) {
      return;
    }
    setError('');
    const trimmedPassword = password.trim();
    const parsedMin = Number(minNumber);
    const parsedMax = Number(maxNumber);
    const parsedWinnerLimit = Number(maxWinners);
    if (trimmedPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) {
      setError('Enter numeric values for the number range.');
      return;
    }
    if (!Number.isFinite(parsedWinnerLimit)) {
      setError('Enter how many winners you want to allow.');
      return;
    }
    if (parsedMin >= parsedMax) {
      setError('Minimum number must be smaller than maximum number.');
      return;
    }
    if (parsedWinnerLimit < 1 || parsedWinnerLimit > 10) {
      setError('Winner limit must be between 1 and 10.');
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: trimmedPassword,
          numberRange: {
            min: Math.floor(parsedMin),
            max: Math.floor(parsedMax)
          },
          maxWinners: Math.floor(parsedWinnerLimit)
        })
      });
      if (!response.ok) {
        throw new Error('Failed to create game');
      }
      const data = await response.json();
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`hostPassword:${data.gameId}`, trimmedPassword);
      }
      navigate(`/host/${data.gameId}`);
    } catch (err) {
      setError(err.message || 'Unable to create game.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h1>Real-time Classroom Bingo</h1>
      <p>Start a live bingo game for your class and track participation in real time.</p>
      <form
        onSubmit={handleCreateGame}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1.5rem'
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Set a host password"
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            border: '1px solid #cbd5f5',
            width: '100%',
            maxWidth: '320px',
            fontSize: '1rem'
          }}
        />
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
          Password must be at least {PASSWORD_MIN_LENGTH} characters.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '1rem'
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Minimum number</span>
            <input
              type="number"
              min="1"
              max="999"
              value={minNumber}
              onChange={(event) => setMinNumber(event.target.value)}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
                width: '140px'
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Maximum number</span>
            <input
              type="number"
              min="1"
              max="999"
              value={maxNumber}
              onChange={(event) => setMaxNumber(event.target.value)}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
                width: '140px'
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Winner limit</span>
            <input
              type="number"
              min="1"
              max="10"
              value={maxWinners}
              onChange={(event) => setMaxWinners(event.target.value)}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
                width: '140px'
              }}
            />
            <span style={{ fontSize: '0.85rem' }}>How many players can win before the round ends.</span>
          </label>
        </div>
        <button type="submit" disabled={isCreating}>
          {isCreating ? 'Creating…' : 'Create Game'}
        </button>
      </form>
      {error ? (
        <p style={{ marginTop: '1rem', color: '#dc2626' }}>{error}</p>
      ) : null}
    </div>
  );
};

export default HomePage;
