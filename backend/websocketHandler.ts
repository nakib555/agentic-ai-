import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer | null = null;
let intervalId: NodeJS.Timeout | null = null;

export function initWebSocket(): WebSocketServer {
  if (intervalId) {
    clearInterval(intervalId);
  }
  
  if (wss) {
    wss.close();
  }

  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connected');

    ws.on('message', (message: string) => {
      console.log(`[WS] Received: ${message}`);
      // Echo back
      ws.send(JSON.stringify({ type: 'echo', content: message.toString() }));
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });

    // Send initial welcome message
    ws.send(JSON.stringify({ type: 'status', content: 'Connected to Real-time Server' }));
  });

  // Broadcast time every second
  intervalId = setInterval(() => {
    broadcast({ type: 'time', content: new Date().toISOString() });
  }, 1000);

  console.log('[WS] WebSocket server initialized');
  return wss;
}

export function broadcast(data: any) {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
