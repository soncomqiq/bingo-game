import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { SocketProvider } from './socket/SocketProvider.jsx';
import './index.css';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <BrowserRouter basename={basePath === '' ? undefined : basePath}>
        <App />
      </BrowserRouter>
    </SocketProvider>
  </React.StrictMode>
);
