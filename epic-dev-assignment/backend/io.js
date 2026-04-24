// Shared Socket.io instance. Routes import `emit()` to broadcast events.
// The instance is set by server.js at startup.
let io = null;

export function setIo(instance) {
  io = instance;
}

/**
 * Broadcast an event to a specific project room (by Jira project key).
 * Clients join rooms via `socket.emit('join', projectKey)`.
 * If io isn't initialised (e.g., migration scripts), this is a no-op.
 */
export function emitToProject(projectKey, event, payload) {
  if (!io || !projectKey) return;
  io.to(`project:${projectKey}`).emit(event, payload);
}
