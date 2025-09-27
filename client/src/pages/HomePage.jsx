import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PASSWORD_MIN_LENGTH = 4;

const HomePage = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleCreateGame = async (event) => {
    event.preventDefault();
    if (isCreating) {
      return;
    }
    setError('');
    const trimmedPassword = password.trim();
    if (trimmedPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: trimmedPassword })
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
      <form onSubmit={handleCreateGame} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        marginTop: '1.5rem'
      }}>
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
