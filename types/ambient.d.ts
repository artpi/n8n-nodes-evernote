declare module 'evernote' {
	namespace Evernote {
		namespace Types {
			class Data {
				constructor(args: { body: Buffer; size: number; bodyHash: Buffer });
			}

			class ResourceAttributes {
				constructor(args: {
					sourceURL?: string;
					timestamp?: number;
					latitude?: number;
					longitude?: number;
					altitude?: number;
					cameraMake?: string;
					cameraModel?: string;
					clientWillIndex?: boolean;
					recoType?: string;
					fileName?: string;
					attachment?: boolean;
					applicationData?: Record<string, unknown>;
				});
			}

			class Resource {
				constructor(args: { data: Data; mime: string; attributes: ResourceAttributes });
			}

			class NoteAttributes {
				constructor(args?: {
					subjectDate?: number;
					latitude?: number;
					longitude?: number;
					altitude?: number;
					author?: string;
					source?: string;
					sourceURL?: string;
					sourceApplication?: string;
					shareDate?: number;
					reminderOrder?: number;
					reminderDoneTime?: number;
					reminderTime?: number;
					placeName?: string;
					contentClass?: string;
					applicationData?: Record<string, unknown>;
					lastEditedBy?: string;
					classifications?: Record<string, string>;
					creatorId?: number;
					lastEditorId?: number;
					sharedWithBusiness?: boolean;
					conflictSourceNoteGuid?: string;
					noteTitleQuality?: number;
				});
			}

			class Note {
				constructor(args?: {
					guid?: string;
					title?: string;
					content?: string;
					notebookGuid?: string;
					resources?: Resource[];
					tagNames?: string[];
					attributes?: NoteAttributes;
					created?: number;
					updated?: number;
				});
				guid?: string;
				title?: string;
				content?: string;
			}
		}

		namespace NoteStore {
			class NoteFilter {
				constructor(args?: Record<string, unknown>);
				words?: string;
				notebookGuid?: string;
				tagGuids?: string[];
			}

			class NotesMetadataResultSpec {
				constructor(args?: Record<string, unknown>);
				includeTitle?: boolean;
				includeUpdated?: boolean;
				includeCreated?: boolean;
				includeTagGuids?: boolean;
			}

			interface NotesMetadata {
				notes: Array<{
					guid: string;
					title?: string;
					updated?: number;
					created?: number;
					tagGuids?: string[];
				}>;
				totalNotes: number;
			}

			class Client {
				constructor(args: unknown);
				getNote(
					noteGuid: string,
					withContent: boolean,
					withResourcesData: boolean,
					withResourcesRecognition: boolean,
					withResourcesAlternateData: boolean,
				): Promise<Evernote.Types.Note>;
				getNoteTagNames(noteGuid: string): Promise<string[]>;
				listTags(): Promise<Array<{ name: string; guid: string }>>;
				listNotebooks(): Promise<Array<{ name: string; guid: string }>>;
				findNotesMetadata(
					filter: NoteFilter,
					offset: number,
					maxNotes: number,
					resultSpec: NotesMetadataResultSpec,
				): Promise<NotesMetadata>;
				expungeNote(noteGuid: string): Promise<void>;
				deleteNote(noteGuid: string): Promise<void>;
				createNote(note: Evernote.Types.Note): Promise<Evernote.Types.Note>;
				updateNote(note: Evernote.Types.Note): Promise<Evernote.Types.Note>;
			}
		}

		class Client {
			constructor(args: unknown);
			getNoteStore(): Evernote.NoteStore.Client;
		}
	}

	const EvernoteExport: typeof Evernote;
	export = EvernoteExport;
	export default EvernoteExport;
	export as namespace Evernote;
}

declare module 'sanitize-html' {
	type SanitizeHtml = (dirty: string, options?: unknown) => string;
	const sanitize: SanitizeHtml;
	export = sanitize;
}
