import EvernoteSDK from 'evernote';
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	buildResourcesFromBinary,
	enmlToHtml,
	extractEnmlBody,
	parseBinaryPropertyNames,
	plainTextToEnml,
	sanitizeHtmlToEnml,
	wrapEnmlBody,
} from './utils';

const splitTags = (raw: string): string[] =>
	raw
		.split(',')
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

export class Evernote implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Evernote',
		name: 'evernote',
		icon: { light: 'file:evernote.svg', dark: 'file:evernote.dark.svg' },
		group: ['input'],
		version: 1,
		description: 'Work with Evernote notes, notebooks and tags',
		defaults: {
			name: 'Evernote',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'evernoteApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				description: 'The type of entity to operate on',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Note', value: 'note' },
					{ name: 'Notebook', value: 'notebook' },
					{ name: 'Tag', value: 'tag' },
				],
				default: 'note',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['note'],
					},
				},
				options: [
					{ name: 'Create', value: 'create', description: 'Create a note', action: 'Create a note' },
					{ name: 'Delete', value: 'delete', description: 'Move a note to trash', action: 'Delete a note' },
					{ name: 'Read', value: 'read', description: 'Get a note by GUID', action: 'Read a note' },
					{ name: 'Search', value: 'search', description: 'Search notes', action: 'Search a note' },
					{ name: 'Update', value: 'update', description: 'Update or append to a note', action: 'Update a note' },
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['notebook'],
					},
				},
				options: [
					{ name: 'List', value: 'list', description: 'List notebooks', action: 'List a notebook' },
				],
				default: 'list',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['tag'],
					},
				},
				options: [
					{ name: 'List', value: 'list', description: 'List tags', action: 'List a tag' },
				],
				default: 'list',
			},
			// Note: common fields
			{
				displayName: 'Note GUID',
				name: 'noteGuid',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['read', 'update', 'delete'],
					},
				},
				default: '',
				description: 'GUID of the note',
			},
			// Note create
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create'],
					},
				},
				default: '',
				description: 'Title of the note',
			},
			{
				displayName: 'Content Mode',
				name: 'contentMode',
				type: 'options',
				required: true,
				options: [
					{ name: 'Plain Text', value: 'plainText' },
					{ name: 'HTML', value: 'html' },
				],
				default: 'plainText',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
					},
				},
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				required: true,
				typeOptions: {
					rows: 5,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
						contentMode: ['plainText'],
					},
				},
				description: 'Plain text to store in the note',
			},
			{
				displayName: 'HTML Content',
				name: 'contentHtml',
				type: 'string',
				required: true,
				typeOptions: {
					rows: 6,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
						contentMode: ['html'],
					},
				},
				description: 'HTML content that will be sanitized into ENML',
			},
			{
				displayName: 'Notebook GUID',
				name: 'notebookGuid',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create'],
					},
				},
				description: 'Notebook to place the note in (optional)',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
					},
				},
				description: 'Comma-separated list of tags',
			},
			{
				displayName: 'Add Attachments',
				name: 'addAttachments',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
					},
				},
				description: 'Whether to attach binary data from the input',
			},
			{
				displayName: 'Binary Property Names',
				name: 'binaryPropertyNames',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
						addAttachments: [true],
					},
				},
				description: 'Comma-separated list of binary properties to attach as resources',
			},
			// Note update specific
			{
				displayName: 'Update Mode',
				name: 'updateMode',
				type: 'options',
				options: [
					{ name: 'Replace', value: 'replace', description: 'Replace the content' },
					{ name: 'Append', value: 'append', description: 'Append to existing content' },
				],
				default: 'replace',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
					},
				},
				description: 'Whether to replace or append the provided content',
			},
			{
				displayName: 'New Title',
				name: 'titleUpdate',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
					},
				},
				description: 'Optionally replace the title',
			},
			// Note read
			{
				displayName: 'Return Content',
				name: 'returnContent',
				type: 'options',
				options: [
					{ name: 'ENML', value: 'enml' },
					{ name: 'HTML', value: 'html' },
					{ name: 'None', value: 'none' },
				],
				default: 'enml',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['read'],
					},
				},
				description: 'Format of the returned content',
			},
			// Search
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '',
				description: "Search query using Evernote's grammar",
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Notebook GUID',
				name: 'searchNotebookGuid',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['search'],
					},
				},
				description: 'Optional notebook to scope the search',
			},
			{
				displayName: 'Return Mode',
				name: 'returnMode',
				type: 'options',
				options: [
					{ name: 'Metadata Only', value: 'metadata' },
					{ name: 'Full Notes', value: 'full' },
				],
				default: 'metadata',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['search'],
					},
				},
				description: 'Default metadata; choose full to fetch complete notes',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['search'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('evernoteApi');
		const accessToken = credentials.accessToken as string;
		const useSandbox = (credentials.useSandbox as boolean) || false;

		const client = new EvernoteSDK.Client({ token: accessToken, sandbox: useSandbox });
		const noteStore = client.getNoteStore();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				if (resource === 'note') {
					if (operation === 'create') {
						const title = this.getNodeParameter('title', itemIndex) as string;
						const contentMode = this.getNodeParameter('contentMode', itemIndex) as string;
						const plainContent = this.getNodeParameter('content', itemIndex, '') as string;
						const htmlContent = this.getNodeParameter('contentHtml', itemIndex, '') as string;
						const notebookGuid = this.getNodeParameter('notebookGuid', itemIndex, '') as string;
						const tagsRaw = this.getNodeParameter('tags', itemIndex, '') as string;
						const addAttachments = this.getNodeParameter('addAttachments', itemIndex, false) as boolean;
						const binaryPropertyNamesRaw = this.getNodeParameter('binaryPropertyNames', itemIndex, 'data') as string;

						const attachmentResult = addAttachments
							? await buildResourcesFromBinary(
								this,
								itemIndex,
								parseBinaryPropertyNames(binaryPropertyNamesRaw),
							)
							: undefined;

						const baseContent =
							contentMode === 'html'
								? sanitizeHtmlToEnml(htmlContent)
								: plainTextToEnml(plainContent);

						const contentBody = extractEnmlBody(baseContent);
						const contentWithMedia = attachmentResult?.mediaTags?.length
							? wrapEnmlBody(`${contentBody}${attachmentResult.mediaTags.join('')}`)
							: baseContent;
						const tagNames = splitTags(tagsRaw);
						const resources = attachmentResult?.resources;

						const note = new EvernoteSDK.Types.Note({
							title,
							content: contentWithMedia,
							notebookGuid: notebookGuid || undefined,
							resources,
							tagNames: tagNames.length ? tagNames : undefined,
						});

						const created = await noteStore.createNote(note);
						returnData.push({ json: created as unknown as IDataObject });
						continue;
					}

					if (operation === 'read') {
						const noteGuid = this.getNodeParameter('noteGuid', itemIndex) as string;
						const returnContent = this.getNodeParameter('returnContent', itemIndex, 'enml') as string;

						const note = await noteStore.getNote(noteGuid, true, true, true, true);
						const output: IDataObject = note as unknown as IDataObject;

						if (returnContent === 'html' && note.content) {
							output.contentHtml = enmlToHtml(note.content);
						} else if (returnContent === 'none') {
							delete output.content;
						}

						returnData.push({ json: output });
						continue;
					}

					if (operation === 'update') {
						const noteGuid = this.getNodeParameter('noteGuid', itemIndex) as string;
						const updateMode = this.getNodeParameter('updateMode', itemIndex) as string;
						const contentMode = this.getNodeParameter('contentMode', itemIndex) as string;
						const plainContent = this.getNodeParameter('content', itemIndex, '') as string;
						const htmlContent = this.getNodeParameter('contentHtml', itemIndex, '') as string;
						const tagsRaw = this.getNodeParameter('tags', itemIndex, '') as string;
						const titleUpdate = this.getNodeParameter('titleUpdate', itemIndex, '') as string;
						const addAttachments = this.getNodeParameter('addAttachments', itemIndex, false) as boolean;
						const binaryPropertyNamesRaw = this.getNodeParameter('binaryPropertyNames', itemIndex, 'data') as string;

						const attachmentResult = addAttachments
							? await buildResourcesFromBinary(
								this,
								itemIndex,
								parseBinaryPropertyNames(binaryPropertyNamesRaw),
							)
							: undefined;

						let newContent =
							contentMode === 'html'
								? sanitizeHtmlToEnml(htmlContent)
								: plainTextToEnml(plainContent);

						if (updateMode === 'append') {
							const existing = await noteStore.getNote(noteGuid, true, false, false, false);
							const existingBody = extractEnmlBody(existing.content || '');
							const newBody = extractEnmlBody(newContent);
							const combined = `${existingBody}${newBody}`;
							newContent = wrapEnmlBody(combined);
						}

						if (attachmentResult?.mediaTags?.length) {
							const updatedBody = extractEnmlBody(newContent);
							newContent = wrapEnmlBody(`${updatedBody}${attachmentResult.mediaTags.join('')}`);
						}

						const resources = attachmentResult?.resources;

						const tagNames = splitTags(tagsRaw);
						const note = new EvernoteSDK.Types.Note({
							guid: noteGuid,
							content: newContent,
							tagNames: tagNames.length ? tagNames : undefined,
							title: titleUpdate || undefined,
							resources,
						});

						const updated = await noteStore.updateNote(note);
						returnData.push({ json: updated as unknown as IDataObject });
						continue;
					}

					if (operation === 'delete') {
						const noteGuid = this.getNodeParameter('noteGuid', itemIndex) as string;
						await noteStore.deleteNote(noteGuid);
						returnData.push({ json: { success: true, noteGuid } });
						continue;
					}

					if (operation === 'search') {
						const query = this.getNodeParameter('query', itemIndex) as string;
						const notebookGuid = this.getNodeParameter('searchNotebookGuid', itemIndex, '') as string;
						const returnMode = this.getNodeParameter('returnMode', itemIndex, 'metadata') as string;
						const limit = this.getNodeParameter('limit', itemIndex, 50) as number;

						const filter = new EvernoteSDK.NoteStore.NoteFilter({
							words: query,
							notebookGuid: notebookGuid || undefined,
						});
						const spec = new EvernoteSDK.NoteStore.NotesMetadataResultSpec({
							includeTitle: true,
							includeCreated: true,
							includeUpdated: true,
							includeNotebookGuid: true,
							includeTagGuids: true,
							includeAttributes: true,
							includeLargestResourceMime: true,
							includeLargestResourceSize: true,
						});

						const searchResult = await noteStore.findNotesMetadata(filter, 0, limit, spec);

						if (returnMode === 'metadata') {
							for (const note of searchResult.notes) {
								returnData.push({ json: note as unknown as IDataObject });
							}
							continue;
						}

						for (const meta of searchResult.notes) {
							const fullNote = await noteStore.getNote(meta.guid, true, true, true, true);
							returnData.push({ json: fullNote as unknown as IDataObject });
						}
						continue;
					}
				}

				if (resource === 'notebook' && operation === 'list') {
					const notebooks = await noteStore.listNotebooks();
					for (const notebook of notebooks) {
						returnData.push({ json: notebook as unknown as IDataObject });
					}
					continue;
				}

				if (resource === 'tag' && operation === 'list') {
					const tags = await noteStore.listTags();
					for (const tag of tags) {
						returnData.push({ json: tag as unknown as IDataObject });
					}
					continue;
				}

				throw new NodeOperationError(this.getNode(), `Unsupported operation: ${resource}/${operation}`, {
					itemIndex,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: this.getInputData(itemIndex)[0]?.json ?? {},
						error,
						pairedItem: itemIndex,
					});
					continue;
				}
				if (error.context) {
					error.context.itemIndex = itemIndex;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}
