import * as A from '@automerge/automerge';
import Emittery from 'emittery';
import {DocumentHeader, type Metadata} from './DocumentHeader';
import {createSignature, getPublicKey} from '../crypto';
import {decode, encode} from 'cbor-x';
import {type DocumentId} from '../types';
import {UnauthorizedAccessError, DocumentValidationError} from './errors';

/**
 * Type representing an event that occurs on a Document.
 */
type DocumentEvent<TData, TMetadata extends Metadata = Metadata> = {
	'patch': {document: Document<TData, TMetadata>; patches: A.Patch[]; before: A.Doc<TData>; after: A.Doc<TData>};
	'change': {document: Document<TData, TMetadata>; data: A.Doc<TData>};
	'header-updated': {document: Document<TData, TMetadata>; header: DocumentHeader<TMetadata>};
	'destroyed': {document: Document<TData, TMetadata>};
};

/**
 * Class representing a Document with generic data type TData.
 * It extends Emittery to emit and handle events.
 */
export class Document<TData, TMetadata extends Metadata = Metadata> extends Emittery<DocumentEvent<TData, TMetadata>> {
	#document: A.Doc<TData>;
	readonly #id: DocumentId;
	#header: DocumentHeader<TMetadata>;
	#lastAccessed: number = Date.now();
	#destroyed = false;

	protected constructor(header: DocumentHeader<TMetadata>) {
		super();
		this.#header = header;
		this.#id = this.#header.address.base58;

		// Initialize a new Automerge document with a patch callback
		this.#document = A.init<TData>({
			patchCallback: ((patches, {before, after}) => {
				void this.emit('patch', {document: this, patches, before, after});
			}) as A.PatchCallback<TData>,
		});
	}

	/**
	 * Load binary data into the document using Automerge's loadIncremental method
	 * @param binary - The binary data.
	 */
	public load(binary: Uint8Array) {
		this.updateLastAccessed();
		try {
			this.#document = A.loadIncremental(this.#document, binary);
		} catch (cause) {
			throw new Error('Failed to load Document', {cause});
		}
	}

	/**
	 * Update document data and emit 'change' event if the document has changed.
	 * @param callback - Function to update the document.
	 * @returns - The updated document.
	 */
	public update(callback: (document: A.Doc<TData>) => A.Doc<TData>) {
		this.updateLastAccessed();
		const newDocument = callback(this.#document);
		if (this.hasChanged(newDocument)) {
			void this.emit('change', {document: this, data: newDocument});
		}

		this.#document = newDocument;
		return this.#document;
	}

	/**
	 * Change the document with the provided callback and options
	 * @param callback - Function to change the document
	 * @param options - Options for the change
	 */
	public change(callback: A.ChangeFn<TData>, options: A.ChangeOptions<TData> = {}) {
		return this.update(document => A.change(document, options, callback));
	}

	/**
	 * Change the document at a given head with the provided callback and options
	 * @param heads - The heads to change at
	 * @param callback - Function to change the document
	 * @param options - Options for the change
	 */
	public changeAt(heads: A.Heads, callback: A.ChangeFn<TData>, options: A.ChangeOptions<TData> = {}) {
		this.update(document => A.changeAt(document, heads, options, callback));
	}

	// Getter for document id
	public get id(): DocumentId {
		return this.#id;
	}

	// Getter for document data
	public get data() {
		this.updateLastAccessed();
		return this.#document;
	}

	// Getter for document header
	public get header() {
		this.updateLastAccessed();
		return this.#header;
	}

	/**
	 * Export the document into binary format and create a signature using provided private key.
	 * @param privateKey - The private key.
	 * @throws {UnauthorizedAccessError} - Throws when a user without permission tries to export the document.
	 * @returns - The exported document.
	 */
	public export(privateKey: Uint8Array): Uint8Array {
		const header = this.#header.export();

		if (!this.#header.hasAllowedUser(getPublicKey(privateKey))) {
			throw new UnauthorizedAccessError('Only the document owner or an allowed user can export the document.');
		}

		const content = A.save(this.data);
		const signature = createSignature(content, privateKey);
		return encode({
			header,
			content,
			signature,
		});
	}

	/**
	 * Clones the document.
	 * @returns - The cloned document.
	 */
	public clone() {
		const document = new Document<TData, TMetadata>(this.#header);
		document.#document = A.clone(this.#document);
		return document;
	}

	/**
	 * Updates the document header and emits 'header-updated' event.
	 * @param header - The new header.
	 * @returns - True if header updated successfully, false otherwise.
	 */
	public updateHeader(header: DocumentHeader<TMetadata>) {
		try {
			this.updateLastAccessed();
			this.#header = DocumentHeader.upgrade(this.#header, header);
			void this.emit('header-updated', {document: this, header: this.#header});
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Merges another document into this one, updating header and data.
	 * @param document - The document to be merged.
	 */
	public mergeDocument(document: Document<TData, TMetadata>) {
		if (this.updateHeader(document.#header)) {
			this.update(doc => A.merge(doc, A.clone(document.#document)));
		}
	}

	/**
	 * Destroys the document.
	 */
	public async destroy() {
		this.#destroyed = true;
		await this.emit('destroyed', {document: this});
		this.clearListeners();
	}

	// Getter for last accessed timestamp
	public get lastAccessed() {
		return this.#lastAccessed;
	}

	// Getter for destroyed
	public get destroyed() {
		return this.#destroyed;
	}

	/**
	 * Checks if a document has changed by comparing the heads of the current and the new document.
	 * @param document - The new document.
	 * @returns - True if the document has changed, false otherwise.
	 */
	private hasChanged(document: A.Doc<TData>) {
		const aHeads = A.getHeads(this.#document);
		const bHeads = A.getHeads(document);
		return !(aHeads.length === bHeads.length && aHeads.every((head: string) => bHeads.includes(head)));
	}

	/**
	 * Updates the last accessed timestamp to the current time.
	 */
	private updateLastAccessed() {
		this.#lastAccessed = Date.now();
	}

	/**
	 * Imports a document from binary format.
	 * @param rawDocument - The raw document in binary format.
	 * @throws {DocumentValidationError} - Throws when document signature is invalid.
	 * @returns - The imported document.
	 */
	public static import<TData, TMetadata extends Metadata = Metadata>(rawDocument: Uint8Array): Document<TData, TMetadata> {
		const {header: rawHeader, content, signature} = decode(rawDocument) as {header: Uint8Array; content: Uint8Array; signature: Uint8Array};
		const header = DocumentHeader.import(rawHeader);

		if (!header.verifySignature(content, signature)) {
			throw new DocumentValidationError('Invalid document signature.');
		}

		return Document.fromRawHeader<TData, TMetadata>(rawHeader, content);
	}

	/**
	 * Creates a new Document object from a raw header and content.
	 * @param rawHeader - The raw header.
	 * @param content - The content.
	 * @returns - The created Document object.
	 */
	public static fromRawHeader<TData, TMetadata extends Metadata = Metadata>(rawHeader: Uint8Array, content: Uint8Array): Document<TData, TMetadata> {
		const document = new Document<TData, TMetadata>(DocumentHeader.import(rawHeader));
		document.load(content);
		return document;
	}

	/**
	 * Creates a new Document object.
	 * @param privateKey - The private key.
	 * @param allowedClients - The allowed clients.
	 * @param metadata - The metadata.
	 */
	public static create<TData, TMetadata extends Metadata>(privateKey: Uint8Array, allowedClients: Uint8Array[] = [], metadata = {} as TMetadata): Document<TData, TMetadata> {
		const header = DocumentHeader.create(privateKey, allowedClients, metadata);
		return new Document(header);
	}
}
