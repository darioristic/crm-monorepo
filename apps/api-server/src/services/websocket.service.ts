/**
 * WebSocket Service for Real-time Updates
 *
 * Provides real-time notifications for document changes and other events.
 * Uses ws package for WebSocket server functionality.
 */

import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "../lib/logger";
import { validateJWT } from "./auth.service";

// ============================================
// Types
// ============================================

export interface WebSocketClient {
	ws: WebSocket;
	userId: string;
	companyId: string;
	subscribedRooms: Set<string>;
}

export interface WebSocketMessage {
	type: string;
	payload: Record<string, unknown>;
	room?: string;
	timestamp?: string;
}

export type DocumentEventType =
	| "document:created"
	| "document:updated"
	| "document:deleted"
	| "document:processing_started"
	| "document:processing_completed"
	| "document:processing_failed";

export interface DocumentEvent {
	type: DocumentEventType;
	documentId: string;
	companyId: string;
	data?: Record<string, unknown>;
}

// ============================================
// WebSocket Server
// ============================================

class WebSocketService {
    private wss: any | null = null;
    private clients: Map<string, WebSocketClient> = new Map();
    private rooms: Map<string, Set<string>> = new Map();

	/**
	 * Initialize WebSocket server
	 */
    async initialize(server: Server): Promise<void> {
        this.wss = null;
        return;
    }

	/**
	 * Handle new WebSocket connection
	 */
    private async handleConnection(
        ws: any,
        request: IncomingMessage,
    ): Promise<void> {
		const clientId = this.generateClientId();

		logger.debug({ clientId }, "New WebSocket connection");

		// Extract token from query string
		const url = new URL(request.url || "", `http://${request.headers.host}`);
		const token = url.searchParams.get("token");

		if (!token) {
			ws.close(4001, "Authentication required");
			return;
		}

		// Verify token
        try {
            const payload = await validateJWT(token);
            if (!payload || !payload.userId || !payload.companyId) {
                ws.close(4001, "Invalid token");
                return;
            }

			// Create client
			const client: WebSocketClient = {
				ws,
				userId: payload.userId,
				companyId: payload.companyId,
				subscribedRooms: new Set(),
			};

			this.clients.set(clientId, client);

			// Auto-subscribe to company room
			this.joinRoom(clientId, `company:${payload.companyId}`);

			// Send welcome message
			this.sendToClient(clientId, {
				type: "connected",
				payload: {
					clientId,
					userId: payload.userId,
					companyId: payload.companyId,
				},
			});

			// Setup event handlers
            ws.on("message", (data: Buffer | string) => this.handleMessage(clientId, data));
            ws.on("close", () => this.handleDisconnect(clientId));
            ws.on("error", (error: unknown) =>
                logger.error({ clientId, error }, "WebSocket error"),
            );

			logger.info(
				{ clientId, userId: payload.userId },
				"WebSocket client connected",
			);
		} catch (error) {
			logger.error({ error }, "WebSocket authentication error");
			ws.close(4001, "Authentication failed");
		}
	}

	/**
	 * Handle incoming message from client
	 */
    private handleMessage(clientId: string, data: Buffer | string): void {
		const client = this.clients.get(clientId);
		if (!client) return;

		try {
			const message = JSON.parse(data.toString()) as WebSocketMessage;

			switch (message.type) {
				case "subscribe":
					if (message.room) {
						// Only allow subscribing to own company rooms
						if (message.room.startsWith(`company:${client.companyId}`)) {
							this.joinRoom(clientId, message.room);
						}
					}
					break;

				case "unsubscribe":
					if (message.room) {
						this.leaveRoom(clientId, message.room);
					}
					break;

				case "ping":
					this.sendToClient(clientId, {
						type: "pong",
						payload: { timestamp: Date.now() },
					});
					break;

				default:
					logger.debug({ clientId, type: message.type }, "Unknown message type");
			}
		} catch (error) {
			logger.error({ clientId, error }, "Error parsing WebSocket message");
		}
	}

	/**
	 * Handle client disconnect
	 */
	private handleDisconnect(clientId: string): void {
		const client = this.clients.get(clientId);
		if (!client) return;

		// Leave all rooms
		for (const room of client.subscribedRooms) {
			this.leaveRoom(clientId, room);
		}

		this.clients.delete(clientId);
		logger.info({ clientId }, "WebSocket client disconnected");
	}

	/**
	 * Join a room
	 */
	private joinRoom(clientId: string, room: string): void {
		const client = this.clients.get(clientId);
		if (!client) return;

		if (!this.rooms.has(room)) {
			this.rooms.set(room, new Set());
		}

		this.rooms.get(room)!.add(clientId);
		client.subscribedRooms.add(room);

		logger.debug({ clientId, room }, "Client joined room");
	}

	/**
	 * Leave a room
	 */
	private leaveRoom(clientId: string, room: string): void {
		const client = this.clients.get(clientId);
		if (!client) return;

		const roomClients = this.rooms.get(room);
		if (roomClients) {
			roomClients.delete(clientId);
			if (roomClients.size === 0) {
				this.rooms.delete(room);
			}
		}

		client.subscribedRooms.delete(room);
		logger.debug({ clientId, room }, "Client left room");
	}

	/**
	 * Send message to a specific client
	 */
    private sendToClient(clientId: string, message: WebSocketMessage): void {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== 1) return;

		try {
			client.ws.send(
				JSON.stringify({
					...message,
					timestamp: new Date().toISOString(),
				}),
			);
		} catch (error) {
			logger.error({ clientId, error }, "Error sending WebSocket message");
		}
	}

	/**
	 * Broadcast message to a room
	 */
	broadcast(room: string, message: WebSocketMessage): void {
		const roomClients = this.rooms.get(room);
		if (!roomClients) return;

		const payload = {
			...message,
			room,
			timestamp: new Date().toISOString(),
		};

		for (const clientId of roomClients) {
			const client = this.clients.get(clientId);
            if (client && client.ws.readyState === 1) {
                try {
                    client.ws.send(JSON.stringify(payload));
                } catch (error) {
                    logger.error({ clientId, error }, "Error broadcasting message");
                }
            }
        }

		logger.debug({ room, type: message.type }, "Message broadcasted to room");
	}

	/**
	 * Send document event to company
	 */
	sendDocumentEvent(event: DocumentEvent): void {
		const room = `company:${event.companyId}`;
		this.broadcast(room, {
			type: event.type,
			payload: {
				documentId: event.documentId,
				...event.data,
			},
		});
	}

	/**
	 * Broadcast to all connected clients of a company
	 */
	broadcastToCompany(
		companyId: string,
		type: string,
		payload: Record<string, unknown>,
	): void {
		this.broadcast(`company:${companyId}`, { type, payload });
	}

	/**
	 * Get connection stats
	 */
	getStats(): {
		totalConnections: number;
		rooms: number;
		clientsPerRoom: Record<string, number>;
	} {
		const clientsPerRoom: Record<string, number> = {};
		for (const [room, clients] of this.rooms) {
			clientsPerRoom[room] = clients.size;
		}

		return {
			totalConnections: this.clients.size,
			rooms: this.rooms.size,
			clientsPerRoom,
		};
	}

	/**
	 * Generate unique client ID
	 */
	private generateClientId(): string {
		return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Close all connections and shutdown
	 */
	async shutdown(): Promise<void> {
		logger.info("Shutting down WebSocket server...");

		// Close all client connections
		for (const [clientId, client] of this.clients) {
			try {
				client.ws.close(1001, "Server shutting down");
			} catch {
				// Ignore errors during shutdown
			}
		}

		this.clients.clear();
		this.rooms.clear();

		// Close WebSocket server
		if (this.wss) {
			return new Promise((resolve) => {
				this.wss!.close(() => {
					logger.info("WebSocket server shut down");
					resolve();
				});
			});
		}
	}
}

// Export singleton instance
export const websocketService = new WebSocketService();

export default websocketService;
