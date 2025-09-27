import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const resolveSocketUrl = () => {
  const windowSocket = typeof window !== 'undefined' ? window.__BINGO_SOCKET_URL__ : undefined;
  const envSocket = import.meta.env.VITE_SOCKET_URL;
  const candidate = (windowSocket || envSocket || '').trim();

  const ensureSecureProtocol = (url) => {
    if (!url) {
      return '';
    }
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (url.startsWith('http://')) {
        return `https://${url.slice('http://'.length)}`;
      }
      if (url.startsWith('ws://')) {
        return `wss://${url.slice('ws://'.length)}`;
      }
    }
    return url;
  };

  if (candidate) {
    return ensureSecureProtocol(candidate);
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000';
  }

  return '';
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const serverUrl = resolveSocketUrl();
    if (!serverUrl) {
      console.error(
        'Socket server URL is not configured. Set VITE_SOCKET_URL during the build to avoid requests to localhost.'
      );
      return undefined;
    }

    const socketInstance = io(serverUrl, {
      autoConnect: true
    });
    setSocket(socketInstance);
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ socket }), [socket]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context.socket;
};
