import {z} from 'zod';
import {SignalingClient, type SignalingClientConfig} from './SignalingClient';
import {MessageExchanger} from '../exchanger/MessageExchanger';
import {PeerManager, SignalMessageSchema} from './PeerManager';
import {DocumentRegistry} from './DocumentRegistry';
import {Document} from '../document/Document';
import {DocumentSynchronizer} from '../synchronizer/DocumentSynchronizer';
import {Storage} from '../storage/Storage';
import {type StorageProvider} from '../storage/StorageProvider';
import {SecureStorageProvider} from '../storage/SecureStorageProvider';
import {type DocumentId} from '../types';

// Configuration type for the document sharing client, which is the same as the signaling client config
type DocumentSharingClientConfig = SignalingClientConfig & {
	storageProvider: StorageProvider;
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

	private readonly peerManager: PeerManager;
	private readonly storage: Storage;
	private readonly synchronizers = new Map<DocumentId, DocumentSynchronizer>();

	/**
	 * @param config - The configuration for the signaling client and the document-sharing client.
	 */
	public constructor(private readonly config: DocumentSharingClientConfig) {
		super(config.privateKey);
		this.client = new SignalingClient(config);

		this.exchanger.setClient(this.client);

		this.peerManager = new PeerManager({
			exchanger: this.exchanger as MessageExchanger<typeof SignalMessageSchema>,
		});

		this.storage = new Storage(
			new SecureStorageProvider(
				config.storageProvider,
				config.privateKey,
			),
		);

		this.setupEvents();
	}

	public get publicKey(): Uint8Array {
		return this.client.publicKey;
	}

	/**
	 * Initiates a connection to the client.
	 * @returns Promise<void>
	 */
	public async connect(): Promise<void> {
		return this.client.connect();
	}

	/**
	 * Disconnects the client.
	 * @returns Promise<void>
	 */
	public async disconnect(): Promise<void> {
		return this.client.disconnect();
	}

	/**
	 * Sends a request document message to the signaling server.
	 * Checks if the document is already available locally, and if not, waits for the response.
	 * @returns A promise that resolves to the requested document.
	 * @param documentId - The ID of the document to request.
	 */
	public async requestDocument<TData>(documentId: DocumentId): Promise<Document<TData>> {
		void this.exchanger.sendMessage({
			type: 'request-document',
			documentId,
		});

		return Promise.any<Document<TData>>([
			this.find<TData>(documentId).then(document => {
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
		]);
	}

	/**
	 * Tries to find a document based on its ID.
	 * @returns The found document or undefined if the document doesn't exist.
	 * @param id - The ID of the document to find.
	 */
	public async find<TData>(id: DocumentId): Promise<Document<TData> | undefined> {
		const document = await super.find<TData>(id);
		if (document) {
			return document;
		}

		const rawHeader = await this.storage.loadHeader(id);
		if (rawHeader) {
			const binary = await this.storage.loadBinary(id);
			return this.add(Document.fromRawHeader(rawHeader, binary));
		}
	}

	/**
	 * Lists all document IDs available in the storage.
	 * @returns An array of document IDs.
	 */
	public async listDocumentIds(): Promise<string[]> {
		return this.storage.list();
	}

	/**
	 * The method sets up all the events needed for the class.
	 * @private
	 */
	private setupEvents(): void {
		this.on('document', async document => {
			// TODO: Check document address and header version, to avoid saving old headers
			await this.storage.addDocument(document);
			document.on('change', async () => {
				await this.storage.save(document);
			});
			this.synchronizers.set(document.id, new DocumentSynchronizer(document));
			await this.emit(`document-${document.id}`, document);
		});

		this.peerManager.on('peer-created', ({documentId, peer}) => {
			this.synchronizers.get(documentId)?.addPeer(peer);
		});

		this.peerManager.on('peer-destroyed', ({documentId, peer}) => {
			this.synchronizers.get(documentId)?.removePeer(peer);
		});

		// Handle request document messages
		this.exchanger.on('request-document', async message => {
			const {documentId} = message.data;
			const document = await this.find(documentId);
			if (document?.header.hasAllowedUser(message.from.publicKey)) {
				await this.exchanger.sendMessage({
					type: 'document-response',
					document: document.export(this.privateKey),
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
			this.add(Document.import(message.data.document));
		});
	}
}
