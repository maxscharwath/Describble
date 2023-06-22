import Emittery from 'emittery';
import WebSocket from 'universal-ws-client';
import {base58} from 'base-x';

/**
 * Events that a connection might emit
 */
type ConnectionEvents = {
	data: Uint8Array;
	close: Error;
};

/**
 * Abstract class Connection. This serves as a blueprint for creating more specific types of connections.
 * It extends the Emittery class, allowing it to emit events of the types defined in ConnectionEvents.
 */
export abstract class Connection extends Emittery<ConnectionEvents> {
	/**
	 * Send data through the connection. The specifics are left to the concrete classes that extend Connection.
	 * @param data - The data to be sent.
	 */
	public abstract send(data: Uint8Array): void;

	/**
	 * Close the connection for a specific reason. The specifics are left to the concrete classes that extend Connection.
	 * @param cause - The reason for closing the connection.
	 */
	public abstract close(cause: string): void;

	/**
	 * Check if the connection is currently active. The specifics are left to the concrete classes that extend Connection.
	 */
	public abstract isConnected(): boolean;
}

/**
 * Class that represents a connection via WebSocket.
 * It extends the abstract class Connection, providing concrete implementation of its abstract methods.
 */
export class WebSocketConnection extends Connection {
	/**
	 * The WebSocketConnection constructor.
	 * @param socket - The WebSocket object to wrap.
	 */
	protected constructor(private readonly socket: WebSocket) {
		super();

		// Setup event listeners for the WebSocket events
		this.socket.on('message', (data: Uint8Array) => {
			// Emit a 'data' event whenever a message event is received from the socket
			void this.emit('data', data);
		});
		this.socket.on('close', (code, reason) => {
			// Emit a 'close' event whenever a close event is received from the socket
			void this.emit('close', new Error(reason.toString()));
		});
		this.socket.on('error', error => {
			// Emit a 'close' event whenever an error event is received from the socket
			void this.emit('close', error);
		});
	}

	/**
	 * Close the WebSocket connection for a specific reason.
	 * @param cause - The reason for closing the connection.
	 */
	public close(cause: string): void {
		// Close the socket connection and remove all listeners
		this.socket.close(1000, cause);
		this.socket.removeAllListeners();
		this.clearListeners();
	}

	/**
	 * Send data through the WebSocket connection.
	 * @param data - The data to be sent.
	 */
	public send(data: Uint8Array): void {
		this.socket.send(data);
	}

	/**
	 * Check if the WebSocket connection is currently active.
	 */
	public isConnected(): boolean {
		// The connection is open if the readyState of the socket is OPEN
		return this.socket.readyState === WebSocket.OPEN;
	}

	/**
	 * Create a new WebSocketConnection from an url, a public key, and a client id.
	 * @param url - The URL to connect to.
	 * @param publicKey - The public key to use.
	 * @param clientId - The client id to use.
	 */
	public static create(url: string, publicKey: Uint8Array, clientId: Uint8Array) {
		// Create a new WebSocketConnection by wrapping a new WebSocket object
		return new WebSocketConnection(new WebSocket(url, {
			headers: {
				'x-public-key': base58.encode(publicKey),
				'x-client-id': base58.encode(clientId),
			},
		}));
	}

	/**
	 * Create a new WebSocketConnection from an existing WebSocket.
	 * @param socket - The existing WebSocket to wrap.
	 */
	public static fromSocket(socket: WebSocket) {
		return new WebSocketConnection(socket);
	}
}
