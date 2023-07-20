import {z} from 'zod';
import {SignalingClient, type SignalingClientConfig} from './SignalingClient';
import {MessageExchanger} from '../exchanger/MessageExchanger';
import {PeerManager, SignalMessageSchema} from './PeerManager';
import {DocumentRegistry} from './DocumentRegistry';
import {Document} from '../document/Document';
import {DocumentSynchronizer} from '../synchronizer/DocumentSynchronizer';
import {Storage} from '../storage/Storage';
import {type StorageProvider} from '../storage/StorageProvider';
import {type DocumentId} from '../types';
import {type Wrtc} from '../wrtc';
import {Deferred, throttle} from '../utils';
import {DocumentPresence} from '../presence/DocumentPresence';
import {SecureStorageProvider} from '../storage/SecureStorageProvider';
import {fastDecryptData, fastEncryptData} from '../crypto';
import {type SessionManager} from '../keys/SessionManager';
import {type Metadata} from '../document/DocumentHeader';

// Configuration type for the document sharing client, which is the same as the signaling client config
type DocumentSharingClientConfig = SignalingClientConfig & {
	sessionManager: SessionManager;
	storageProvider: StorageProvider;
	wrtc?: Wrtc;
};

type DocumentSharingClientEvent = {
	[key: `document-${DocumentId}`]: Document<any>;
	'share-document': {
		document: Document<any>;
		to: {publicKey: Uint8Array;clientId: Uint8Array};
	};
};

// Schema for a request document message
export const RequestDocumentMessageSchema = z.object({
	type: z.literal('request-document'),
	documentId: z.string(),
});

// Schema for a document response message
export const ResponseDocumentMessageSchema = z.object({
	type: z.literal('document-response'),
	document: z.instanceof(Uint8Array),
});

/**
 * The DocumentSharingClient class handles the sharing of documents over the signaling server.
 * It uses the MessageExchanger class to send and receive fully verified and typed messages.
 */
export class DocumentSharingClient extends DocumentRegistry<DocumentSharingClientEvent> {
	private readonly client: SignalingClient;
	private readonly exchanger = new MessageExchanger([
		RequestDocumentMessageSchema,
		ResponseDocumentMessageSchema,
		SignalMessageSchema,
	]);

	private readonly connecting = new Deferred<void>();

	private readonly peerManager: PeerManager;
	private readonly storage: Storage;
	private readonly synchronizers = new Map<DocumentId, DocumentSynchronizer>();

	/**
	 * @param config - The configuration for the signaling client and the document-sharing client.
	 */
	public constructor(private readonly config: DocumentSharingClientConfig) {
		super(config.sessionManager);
		this.client = new SignalingClient(config);

		this.client.on('connect', () => {
			this.connecting.resolve();
		});

		this.exchanger.setClient(this.client);

		this.peerManager = new PeerManager({
			exchanger: this.exchanger as MessageExchanger<typeof SignalMessageSchema>,
			verifyIncomingSignal: async message => {
				const document = await this.findDocument(message.data.documentId);
				return document?.header.hasAllowedUser(message.from.publicKey) ?? false;
			},
			wrtc: config.wrtc,
		});

		this.storage = new Storage(
			new SecureStorageProvider(config.storageProvider, config.sessionManager, {
				encrypt: fastEncryptData,
				decrypt: fastDecryptData,
			}),
		);

		this.config.sessionManager.onLogin(() => {
			void this.connect();
		});

		this.setupEvents();
	}

	public get publicKey(): Uint8Array {
		return this.config.sessionManager.currentSession.publicKey;
	}

	/**
	 * Initiates a connection to the client.
	 * @returns Promise<this>
	 */
	public async connect(): Promise<this> {
		this.connecting.reset();
		await this.client.connect(this.config.sessionManager.currentSession);
		return this;
	}

	public async waitForConnection(): Promise<boolean> {
		await this.connecting.promise;
		return this.client.connected;
	}

	/**
	 * Disconnects the client.
	 * @returns Promise<this>
	 */
	public async disconnect(): Promise<this> {
		await this.client.disconnect();
		return this;
	}

	/**
	 * Sends a request document message to the signaling server.
	 * Checks if the document is already available locally, and if not, waits for the response.
	 * @returns A promise that resolves to the requested document.
	 * @param documentId - The ID of the document to request.
	 */
	public async requestDocument<TData, TMetadata extends Metadata = Metadata>(documentId: DocumentId): Promise<Document<TData, TMetadata>> {
		void this.exchanger.sendMessage({
			type: 'request-document',
			documentId,
		});

		return Promise.any([
			this.findDocument<TData>(documentId).then(document => {
				if (!document) {
					throw new Error('Document not found');
				}

				return document;
			}),
			Promise.race<Document<TData>>([
				this.once(`document-${documentId}`),
				new Promise((_, reject) => {
					setTimeout(() => {
						reject(new Error('Document request timed out'));
					}, 5000);
				}),
			]),
		]) as Promise<Document<TData, TMetadata>>;
	}

	/**
	 * Tries to find a document based on its ID.
	 * @returns The found document or undefined if the document doesn't exist.
	 * @param id - The ID of the document to find.
	 */
	public async findDocument<TData, TMetadata extends Metadata = Metadata>(id: DocumentId): Promise<Document<TData, TMetadata> | undefined> {
		const document = await super.findDocument<TData, TMetadata>(id);
		if (document) {
			return document;
		}

		const rawHeader = await this.storage.loadHeader(id);
		if (rawHeader) {
			const binary = await this.storage.loadBinary(id);
			return this.setDocument(Document.fromRawHeader<TData, TMetadata>(rawHeader, binary));
		}
	}

	public async deleteDocument(id: DocumentId) {
		await Promise.all([
			super.removeDocument(id),
			this.storage.remove(id),
		]);
	}

	/**
	 * Lists all document IDs available in the storage.
	 * @returns An array of document IDs.
	 */
	public async listDocumentIds(): Promise<string[]> {
		return this.storage.list();
	}

	public getPresence(documentId: DocumentId) {
		return new DocumentPresence(documentId, this.peerManager);
	}

	/**
	 * The method sets up all the events needed for the class.
	 * @private
	 */
	private setupEvents(): void {
		this.on('document-updated', async document => {
			await this.storage.setDocument(document);
		});

		this.on('document-added', async document => {
			await this.storage.setDocument(document);
			document.on('header-updated', async () => {
				await this.storage.setDocument(document);
			});

			// Throttle the save method to avoid saving too often
			const throttledSave = throttle(async () => this.storage.save(document), 500);
			document.on('change', async () => {
				await throttledSave();
			});
			this.synchronizers.set(document.id, new DocumentSynchronizer(document, this.peerManager));
			await this.emit(`document-${document.id}`, document);
		});

		this.on('document-destroyed', async document => {
			this.synchronizers.get(document.id)?.destroy();
		});

		// Handle request document messages
		this.exchanger.on('request-document', async message => {
			const {documentId} = message.data;
			const document = await this.findDocument(documentId);
			if (document?.header.hasAllowedUser(message.from.publicKey)) {
				await this.exchanger.sendMessage({
					type: 'document-response',
					document: document.export(this.config.sessionManager.currentSession.privateKey),
				}, message.from);

				await this.emit('share-document', {
					document,
					to: message.from,
				});

				this.peerManager.createPeer(true, documentId, message.from);
			}
		});

		// Handle document response messages
		this.exchanger.on('document-response', message => {
			void this.setDocument(Document.import(message.data.document));
		});
	}
}
