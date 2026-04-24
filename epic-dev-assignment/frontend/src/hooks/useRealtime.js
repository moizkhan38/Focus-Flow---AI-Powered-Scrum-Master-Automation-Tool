import { useEffect } from 'react';
import { io } from 'socket.io-client';

// Singleton socket — shared across all components so we don't open N connections.
let socket = null;
function getSocket() {
  if (!socket) {
    // In dev, Vite proxies the HTTP API but NOT websockets. Connect directly to :3003.
    socket = io('http://localhost:3003', { transports: ['websocket'], autoConnect: true });
  }
  return socket;
}

/**
 * Subscribe to realtime updates for a Jira project.
 * When the backend broadcasts `issue:changed`, the supplied callback runs.
 * Typical use: pass a SWR mutate() so the kanban refreshes instantly.
 */
export function useRealtimeProject(projectKey, onIssueChanged) {
  useEffect(() => {
    if (!projectKey) return;
    const s = getSocket();
    s.emit('join', projectKey);
    const handler = (payload) => {
      try { onIssueChanged?.(payload); } catch (e) { console.warn('[Realtime] handler error:', e); }
    };
    s.on('issue:changed', handler);
    return () => {
      s.emit('leave', projectKey);
      s.off('issue:changed', handler);
    };
  }, [projectKey, onIssueChanged]);
}
