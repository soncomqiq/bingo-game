import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import HostView from './pages/HostView.jsx';
import PlayerView from './pages/PlayerView.jsx';

const App = () => (
  <main>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/host/:gameId" element={<HostView />} />
      <Route path="/game/:gameId" element={<PlayerView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </main>
);

export default App;
