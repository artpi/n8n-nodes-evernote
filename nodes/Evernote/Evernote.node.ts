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
	transformNote,
	wrapEnmlBody,
} from './utils';

type NoteAttributes = InstanceType<typeof EvernoteSDK.Types.NoteAttributes>;

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
					{ name: 'List', value: 'list', description: 'List notebooks', action: 'List notebooks' },
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
					{ name: 'List', value: 'list', description: 'List tags', action: 'List tags' },
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
			// Note update specific
			{
				displayName: 'Content Editing Mode',
				name: 'contentEditingMode',
				type: 'options',
				options: [
					{ name: 'Append to Content', value: 'append', description: 'Append provided content to existing content' },
					{ name: 'Keep Existing Content', value: 'keep', description: 'Do not modify the content body' },
					{ name: 'Replace Content', value: 'replace', description: 'Replace the note content with provided content' },
					{
						name: 'Search & Replace in Content',
						value: 'searchReplace',
						description: 'Search and replace text inside the existing content',
					},
				],
				default: 'replace',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
					},
				},
				description: 'How to edit the note content when updating',
			},
			{
				displayName: 'Search Text / Pattern',
				name: 'searchValue',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
						contentEditingMode: ['searchReplace'],
					},
				},
				description:
					'Text or (if enabled) regular expression pattern to search for in the existing content',
			},
			{
				displayName: 'Use Regular Expression',
				name: 'useRegex',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
						contentEditingMode: ['searchReplace'],
					},
				},
				description: 'Whether Search Text / Pattern should be treated as a regular expression',
			},
			{
				displayName: 'Case Sensitive',
				name: 'caseSensitive',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
						contentEditingMode: ['searchReplace'],
					},
				},
				description: 'Whether search should be case sensitive',
			},
			{
				displayName: 'Content Format',
				name: 'contentMode',
				type: 'options',
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
					hide: {
						contentEditingMode: ['keep'],
					},
				},
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
					},
					hide: {
						contentMode: ['html'],
						contentEditingMode: ['keep'],
					},
				},
				description: 'Plain text content. In Search & Replace mode, this is the replacement text.',
			},
			{
				displayName: 'HTML Content',
				name: 'contentHtml',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
					},
					hide: {
						contentMode: ['plainText'],
						contentEditingMode: ['keep'],
					},
				},
				description: 'HTML content. In Search & Replace mode, this is the replacement text.',
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
				displayName: 'Tags Mode',
				name: 'tagsMode',
				type: 'options',
				options: [
					{ name: 'Replace', value: 'replace', description: 'Replace all tags with the provided list' },
					{ name: 'Add', value: 'add', description: 'Add provided tags to existing tags' },
					{ name: 'Remove', value: 'remove', description: 'Remove provided tags from existing tags' },
					{ name: 'Don\'t Change Tags', value: 'ignore', description: 'Do not modify tags' },
				],
				default: 'replace',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
					},
				},
				description: 'How to handle tags when updating',
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
					hide: {
						tagsMode: ['ignore'],
					},
				},
				description: 'Comma-separated list of tags',
			},
			{
				displayName: 'Note Attributes (JSON)',
				name: 'attributesJson',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
					},
				},
				description:
					'Optional note attributes as JSON (e.g. {"sourceURL": "https://example.com"})',
			},
			{
				displayName: 'Note Attributes',
				name: 'noteAttributesUi',
				type: 'collection',
				placeholder: 'Add Attribute',
				default: {},
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{
						displayName: 'Author',
						name: 'author',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Latitude',
						name: 'latitude',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Longitude',
						name: 'longitude',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Place Name',
						name: 'placeName',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Source',
						name: 'source',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Source URL',
						name: 'sourceURL',
						type: 'string',
						default: '',
					},
				],
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
			{
				displayName: 'New Title',
				name: 'titleUpdate',
				type: 'string',
				placeholder: 'Do not change',
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
					},
				},
				description: 'Optionally replace the title',
			},
			{
				displayName: 'Notebook GUID',
				name: 'notebookGuidUpdate',
				type: 'string',
				placeholder: 'Do not change',
				default: '',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['update'],
					},
				},
				description: 'Notebook to move the note to (optional)',
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
					{ name: 'Metadata + Content', value: 'content' },
					{ name: 'Metadata + Content + Media', value: 'media' },
				],
				default: 'metadata',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['search'],
					},
				},
				description: 'What information to return',
			},
			{
				displayName: 'Content Format',
				name: 'searchReturnContentFormat',
				type: 'options',
				options: [
					{ name: 'ENML', value: 'enml' },
					{ name: 'HTML', value: 'html' },
				],
				default: 'enml',
				displayOptions: {
					show: {
						resource: ['note'],
						operation: ['search'],
					},
					hide: {
						returnMode: ['metadata'],
					},
				},
				description: 'Format of the returned content',
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
						const attributesJson = this.getNodeParameter('attributesJson', itemIndex, '') as string;
						const noteAttributesUi = this.getNodeParameter('noteAttributesUi', itemIndex, {}) as IDataObject;
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
						let attributes: NoteAttributes | undefined;
						const attributesObj: Record<string, unknown> = {};

						if (attributesJson) {
							try {
								const parsed = JSON.parse(attributesJson);
								Object.assign(attributesObj, parsed);
							} catch {
								throw new NodeOperationError(this.getNode(), 'Invalid JSON in Note Attributes', {
									itemIndex,
								});
							}
						}

						if (Object.keys(noteAttributesUi).length > 0) {
							Object.assign(attributesObj, noteAttributesUi);
						}

						if (Object.keys(attributesObj).length > 0) {
							attributes = new EvernoteSDK.Types.NoteAttributes(attributesObj);
						}

						// Build note object with only the fields that have actual values
						const noteData: Record<string, unknown> = {
							title,
							content: contentWithMedia,
						};

						if (notebookGuid) {
							noteData.notebookGuid = notebookGuid;
						}
						if (resources) {
							noteData.resources = resources;
						}
						if (tagNames.length) {
							noteData.tagNames = tagNames;
						}
						if (attributes) {
							noteData.attributes = attributes;
						}

						const note = new EvernoteSDK.Types.Note(noteData);

						const created = await noteStore.createNote(note);
						returnData.push({ json: transformNote(created) as unknown as IDataObject });
						continue;
					}

					if (operation === 'read') {
						const noteGuid = this.getNodeParameter('noteGuid', itemIndex) as string;
						const returnContent = this.getNodeParameter('returnContent', itemIndex, 'enml') as string;

						const note = await noteStore.getNote(noteGuid, true, true, true, true);
						const output: IDataObject = transformNote(note) as unknown as IDataObject;

						if (returnContent === 'html' && note.content) {
							output.content = enmlToHtml(note.content);
						} else if (returnContent === 'none') {
							delete output.content;
						}

						returnData.push({ json: output });
						continue;
					}

					if (operation === 'update') {
						const noteGuid = this.getNodeParameter('noteGuid', itemIndex) as string;
						const contentEditingMode = this.getNodeParameter('contentEditingMode', itemIndex, 'replace') as string;
						const contentMode = this.getNodeParameter('contentMode', itemIndex, 'plainText') as string;
						const plainContent = this.getNodeParameter('content', itemIndex, '') as string;
						const htmlContent = this.getNodeParameter('contentHtml', itemIndex, '') as string;
						const tagsRaw = this.getNodeParameter('tags', itemIndex, '') as string;
						const tagsMode = this.getNodeParameter('tagsMode', itemIndex, 'replace') as string;
						const titleUpdate = this.getNodeParameter('titleUpdate', itemIndex, '') as string;
						const notebookGuidUpdate = this.getNodeParameter('notebookGuidUpdate', itemIndex, '') as string;
						const attributesJson = this.getNodeParameter('attributesJson', itemIndex, '') as string;
						const noteAttributesUi = this.getNodeParameter('noteAttributesUi', itemIndex, {}) as IDataObject;
						const searchValue = this.getNodeParameter('searchValue', itemIndex, '') as string;
						const useRegex = this.getNodeParameter('useRegex', itemIndex, false) as boolean;
						const caseSensitive = this.getNodeParameter('caseSensitive', itemIndex, false) as boolean;
						const addAttachments = this.getNodeParameter('addAttachments', itemIndex, false) as boolean;
						const binaryPropertyNamesRaw = this.getNodeParameter('binaryPropertyNames', itemIndex, 'data') as string;

						const attachmentResult = addAttachments
							? await buildResourcesFromBinary(
								this,
								itemIndex,
								parseBinaryPropertyNames(binaryPropertyNamesRaw),
							)
							: undefined;

						// We need to fetch the existing note to get the current title (required for update)
						// and potentially the content for keep/append/searchReplace modes
						const needsExistingContent = ['keep', 'append', 'searchReplace'].includes(contentEditingMode);
						// Always fetch note (for title), but only include content when needed
						const existingNote = await noteStore.getNote(noteGuid, needsExistingContent || !titleUpdate, false, false, false);

						let newContent = '';
						if (contentEditingMode === 'keep') {
							newContent = existingNote.content || wrapEnmlBody('');
						} else if (contentEditingMode === 'replace') {
							newContent =
								contentMode === 'html'
									? sanitizeHtmlToEnml(htmlContent)
									: plainTextToEnml(plainContent);
						} else if (contentEditingMode === 'append') {
							const existingBody = extractEnmlBody(existingNote.content || '');
							const newPart =
								contentMode === 'html'
									? sanitizeHtmlToEnml(htmlContent)
									: plainTextToEnml(plainContent);
							const newBody = extractEnmlBody(newPart);
							const combined = `${existingBody}${newBody}`;
							newContent = wrapEnmlBody(combined);
						} else if (contentEditingMode === 'searchReplace') {
							const existingBody = extractEnmlBody(existingNote.content || '');
							if (!searchValue) {
								throw new NodeOperationError(
									this.getNode(),
									'"Search Text / Pattern" is required when using Search & Replace mode',
									{ itemIndex },
								);
							}
							let pattern = searchValue;
							if (!useRegex) {
								pattern = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
							}
							let regex: RegExp;
							try {
								regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
							} catch {
								throw new NodeOperationError(
									this.getNode(),
									'Invalid regular expression for Search Text / Pattern',
									{
										itemIndex,
									},
								);
							}
							// Use content/htmlContent as the replacement text
							const replaceValue = contentMode === 'html' ? htmlContent : plainContent;
							const replacedBody = existingBody.replace(regex, replaceValue);
							newContent = wrapEnmlBody(replacedBody);
						}

						if (attachmentResult?.mediaTags?.length) {
							const updatedBody = extractEnmlBody(newContent);
							newContent = wrapEnmlBody(`${updatedBody}${attachmentResult.mediaTags.join('')}`);
						}

						const resources = attachmentResult?.resources;

						let tagNames: string[] = [];
						if (tagsMode !== 'ignore') {
							tagNames = splitTags(tagsRaw);
						}

						if (tagsMode === 'add' || tagsMode === 'remove') {
							const existingTagNames = await noteStore.getNoteTagNames(noteGuid);
							if (tagsMode === 'add') {
								tagNames = [...new Set([...existingTagNames, ...tagNames])];
							} else if (tagsMode === 'remove') {
								tagNames = existingTagNames.filter((tag: string) => !tagNames.includes(tag));
							}
						}

						let attributes: NoteAttributes | undefined;
						const attributesObj: Record<string, unknown> = {};

						if (attributesJson) {
							try {
								const parsed = JSON.parse(attributesJson);
								Object.assign(attributesObj, parsed);
							} catch {
								throw new NodeOperationError(this.getNode(), 'Invalid JSON in Note Attributes', {
									itemIndex,
								});
							}
						}

						if (Object.keys(noteAttributesUi).length > 0) {
							Object.assign(attributesObj, noteAttributesUi);
						}

						if (Object.keys(attributesObj).length > 0) {
							attributes = new EvernoteSDK.Types.NoteAttributes(attributesObj);
						}

						// Build note object - title is required, use new title or existing
						const noteData: Record<string, unknown> = {
							guid: noteGuid,
							title: titleUpdate || existingNote.title,
							content: newContent,
						};

						// Only include optional fields if they have actual values
						if (tagsMode !== 'ignore') {
							noteData.tagNames = tagNames;
						}
						if (resources) {
							noteData.resources = resources;
						}
						if (notebookGuidUpdate) {
							noteData.notebookGuid = notebookGuidUpdate;
						}
						if (attributes) {
							noteData.attributes = attributes;
						}

						const note = new EvernoteSDK.Types.Note(noteData);

						const updated = await noteStore.updateNote(note);
						returnData.push({ json: transformNote(updated) as unknown as IDataObject });
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
						const searchReturnContentFormat = this.getNodeParameter('searchReturnContentFormat', itemIndex, 'enml') as string;
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
								returnData.push({ json: transformNote(note) as unknown as IDataObject });
							}
							continue;
						}

						for (const meta of searchResult.notes) {
							// If returnMode is 'content', we fetch content but no resources
							// If returnMode is 'media', we fetch everything
							const withResources = returnMode === 'media';
							const fullNote = await noteStore.getNote(
								meta.guid,
								true,           // withContent
								withResources,  // withResourcesData
								withResources,  // withResourcesRecognition
								withResources,  // withResourcesAlternateData
							);
							const output: IDataObject = transformNote(fullNote) as unknown as IDataObject;

							if (searchReturnContentFormat === 'html' && fullNote.content) {
								output.content = enmlToHtml(fullNote.content);
							}

							returnData.push({ json: output });
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
				// Extract meaningful error message from Evernote API errors
				let errorMessage: string;
				if (error instanceof Error) {
					errorMessage = error.message;
				} else if (typeof error === 'object' && error !== null) {
					// Evernote SDK errors often have errorCode and message properties
					const errObj = error as Record<string, unknown>;
					if (errObj.message) {
						errorMessage = String(errObj.message);
					} else if (errObj.errorCode) {
						errorMessage = `Evernote API error code: ${errObj.errorCode}${errObj.parameter ? ` (parameter: ${errObj.parameter})` : ''}`;
					} else {
						errorMessage = JSON.stringify(error);
					}
				} else {
					errorMessage = String(error);
				}

				// Add helpful context for common Evernote errors
				if (errorMessage.includes('RTE room has already been open')) {
					errorMessage += ' — The note is currently open in the Evernote editor. Please close it and try again.';
				}

				if (this.continueOnFail()) {
					returnData.push({
						json: this.getInputData(itemIndex)[0]?.json ?? {},
						error: new NodeOperationError(this.getNode(), errorMessage, { itemIndex }),
						pairedItem: itemIndex,
					});
					continue;
				}
				if (error && typeof error === 'object' && 'context' in error) {
					(error as { context: { itemIndex: number } }).context.itemIndex = itemIndex;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), errorMessage, {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}
