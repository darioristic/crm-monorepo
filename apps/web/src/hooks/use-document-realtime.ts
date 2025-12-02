"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

// ============================================
// Types
// ============================================

interface WebSocketMessage {
	type: string;
	payload: Record<string, unknown>;
	room?: string;
	timestamp?: string;
}

type DocumentEventType =
	| "document:created"
	| "document:updated"
	| "document:deleted"
	| "document:processing_started"
	| "document:processing_completed"
	| "document:processing_failed";

interface UseDocumentRealtimeOptions {
	enabled?: boolean;
	showNotifications?: boolean;
	onDocumentCreated?: (documentId: string) => void;
	onDocumentUpdated?: (documentId: string) => void;
	onDocumentDeleted?: (documentId: string) => void;
}

interface UseDocumentRealtimeReturn {
	isConnected: boolean;
	reconnect: () => void;
}

// ============================================
// WebSocket URL Helper
// ============================================

function getWebSocketUrl(token: string): string {
	const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
	const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
	const wsHost = apiUrl.replace(/^https?:\/\//, "");
	return `${wsProtocol}://${wsHost}/ws?token=${encodeURIComponent(token)}`;
}

// ============================================
// Hook
// ============================================

export function useDocumentRealtime(
	options: UseDocumentRealtimeOptions = {},
): UseDocumentRealtimeReturn {
	const {
		enabled = true,
		showNotifications = true,
		onDocumentCreated,
		onDocumentUpdated,
		onDocumentDeleted,
	} = options;

	const queryClient = useQueryClient();
	const { toast } = useToast();
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const reconnectAttempts = useRef(0);
	const maxReconnectAttempts = 5;

	// Handle incoming messages
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			try {
				const message = JSON.parse(event.data) as WebSocketMessage;

				switch (message.type as DocumentEventType | string) {
					case "connected":
						logger.debug("WebSocket connected", { payload: message.payload });
						break;

					case "document:created": {
						const docId = message.payload.documentId as string;
						queryClient.invalidateQueries({ queryKey: ["documents"] });
						onDocumentCreated?.(docId);
						if (showNotifications) {
							toast({
								title: "New document",
								description: "A new document has been added to the vault",
							});
						}
						break;
					}

					case "document:updated": {
						const docId = message.payload.documentId as string;
						queryClient.invalidateQueries({ queryKey: ["documents"] });
						queryClient.invalidateQueries({
							queryKey: ["document", docId],
						});
						onDocumentUpdated?.(docId);
						break;
					}

					case "document:deleted": {
						const docId = message.payload.documentId as string;
						queryClient.invalidateQueries({ queryKey: ["documents"] });
						onDocumentDeleted?.(docId);
						if (showNotifications) {
							toast({
								title: "Document deleted",
								description: "A document has been removed from the vault",
							});
						}
						break;
					}

					case "document:processing_completed": {
						const docId = message.payload.documentId as string;
						queryClient.invalidateQueries({ queryKey: ["documents"] });
						queryClient.invalidateQueries({
							queryKey: ["document", docId],
						});
						if (showNotifications) {
							toast({
								title: "Processing complete",
								description:
									"Document has been processed and is ready to view",
							});
						}
						break;
					}

					case "document:processing_failed": {
						if (showNotifications) {
							toast({
								title: "Processing failed",
								description:
									"There was an error processing the document",
								variant: "destructive",
							});
						}
						break;
					}

					case "pong":
						// Heartbeat response
						break;

					default:
						logger.debug("Unknown WebSocket message", { type: message.type });
				}
			} catch (error) {
				logger.error("Error parsing WebSocket message", error);
			}
		},
		[
			queryClient,
			toast,
			showNotifications,
			onDocumentCreated,
			onDocumentUpdated,
			onDocumentDeleted,
		],
	);

	// Connect to WebSocket
	const connect = useCallback(async () => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			return;
		}

		// Get auth token (from cookie or localStorage)
		const token = document.cookie
			.split("; ")
			.find((row) => row.startsWith("auth_token="))
			?.split("=")[1];

		if (!token) {
			logger.warn("No auth token available for WebSocket connection");
			return;
		}

		try {
			const wsUrl = getWebSocketUrl(token);
			const ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				logger.debug("WebSocket connected");
				setIsConnected(true);
				reconnectAttempts.current = 0;
			};

			ws.onmessage = handleMessage;

			ws.onclose = (event) => {
				logger.debug("WebSocket closed", { code: event.code, reason: event.reason });
				setIsConnected(false);
				wsRef.current = null;

				// Attempt to reconnect
				if (
					enabled &&
					reconnectAttempts.current < maxReconnectAttempts &&
					event.code !== 4001 // Don't reconnect on auth errors
				) {
					const delay = Math.min(
						1000 * Math.pow(2, reconnectAttempts.current),
						30000,
					);
					reconnectAttempts.current++;
					logger.debug(`Reconnecting in ${delay}ms...`);
					reconnectTimeoutRef.current = setTimeout(connect, delay);
				}
			};

			ws.onerror = (error) => {
				logger.error("WebSocket error", error);
			};

			wsRef.current = ws;

			// Setup heartbeat
			const heartbeatInterval = setInterval(() => {
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: "ping" }));
				}
			}, 30000);

			// Cleanup heartbeat on close
			ws.addEventListener("close", () => {
				clearInterval(heartbeatInterval);
			});
		} catch (error) {
			logger.error("WebSocket connection error", error);
		}
	}, [enabled, handleMessage]);

	// Reconnect function
	const reconnect = useCallback(() => {
		if (wsRef.current) {
			wsRef.current.close();
		}
		reconnectAttempts.current = 0;
		connect();
	}, [connect]);

	// Connect on mount, disconnect on unmount
	useEffect(() => {
		if (enabled) {
			connect();
		}

		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (wsRef.current) {
				wsRef.current.close();
			}
		};
	}, [enabled, connect]);

	return {
		isConnected,
		reconnect,
	};
}

export default useDocumentRealtime;

