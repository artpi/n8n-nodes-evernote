import { createHash } from 'crypto';
import Evernote from 'evernote';
import sanitizeHtml from 'sanitize-html';
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

type EvernoteResource = InstanceType<typeof Evernote.Types.Resource>;
type EvernoteNote = InstanceType<typeof Evernote.Types.Note>;

const enmlDocType = '<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">';

const allowedTags = [
	'en-note',
	'en-media',
	'a',
	'b',
	'strong',
	'i',
	'em',
	'u',
	's',
	'strike',
	'sub',
	'sup',
	'p',
	'br',
	'ul',
	'ol',
	'li',
	'div',
	'span',
	'pre',
	'code',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
];

const allowedAttributes: Record<string, string[]> = {
	a: ['href', 'title', 'name'],
	div: ['style'],
	span: ['style'],
	p: ['style'],
	table: ['style', 'border', 'cellpadding', 'cellspacing'],
	th: ['style', 'colspan', 'rowspan'],
	td: ['style', 'colspan', 'rowspan'],
	tr: ['style'],
	h1: ['style'],
	h2: ['style'],
	h3: ['style'],
	h4: ['style'],
	h5: ['style'],
	h6: ['style'],
	'en-media': ['type', 'hash', 'width', 'height', 'style', 'align', 'alt', 'longdesc', 'reco-type'],
	'en-note': ['style'],
};

const sanitizerOptions = {
	allowedTags,
	allowedAttributes,
	allowedSchemes: ['http', 'https', 'mailto', 'data'],
	selfClosing: ['br', 'hr', 'img', 'en-media'],
	enforceHtmlBoundary: true,
	parser: { xmlMode: true },
	transformTags: {
		enmedia: 'en-media',
	},
};

const escapeXml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const wrapEnmlBody = (body: string): string =>
	`<?xml version="1.0" encoding="UTF-8"?>\n${enmlDocType}<en-note>${body}</en-note>`;

export const extractEnmlBody = (enml: string): string => {
	const match = enml.match(/<en-note[^>]*>([\s\S]*?)<\/en-note>/i);
	return match ? match[1] : '';
};

export const plainTextToEnml = (text: string): string => {
	const escaped = escapeXml(text).replace(/\r?\n/g, '<br />');
	const body = `<div>${escaped}</div>`;
	return wrapEnmlBody(body);
};

export const sanitizeHtmlToEnml = (html: string): string => {
	const sanitized = sanitizeHtml(html, sanitizerOptions);
	return wrapEnmlBody(sanitized);
};

export const enmlToHtml = (enml: string): string => {
	const withoutProlog = enml
		.replace(/<\?xml[^>]*>/i, '')
		.replace(/<!DOCTYPE[^>]*>/i, '')
		.trim();
	return withoutProlog
		.replace(/<en-note([^>]*)>/i, '<div$1>')
		.replace(/<\/en-note>/i, '</div>')
		.replace(/<en-todo checked="true"\s*\/?>/gi, '<input type="checkbox" checked disabled>')
		.replace(/<en-todo checked="false"\s*\/?>/gi, '<input type="checkbox" disabled>')
		.replace(/<en-todo\s*\/?>/gi, '<input type="checkbox" disabled>');
};

export interface ResourceBuildResult {
	resources: EvernoteResource[];
	mediaTags: string[];
}

export const buildResourcesFromBinary = async (
	executor: IExecuteFunctions,
	itemIndex: number,
	propertyNames: string[],
): Promise<ResourceBuildResult> => {
	const resources: EvernoteResource[] = [];
	const mediaTags: string[] = [];
	for (const propertyName of propertyNames) {
		executor.helpers.assertBinaryData(itemIndex, propertyName);
		const buffer = await executor.helpers.getBinaryDataBuffer(itemIndex, propertyName);
		const binaryData = executor.getInputData()[itemIndex]?.binary?.[propertyName];
		const bodyHash = createHash('md5').update(buffer).digest();
		const mime = binaryData?.mimeType || 'application/octet-stream';
		const data = new Evernote.Types.Data({
			body: buffer,
			size: buffer.length,
			bodyHash,
		});
		const fileNameValue =
			typeof binaryData?.fileName === 'string'
				? binaryData.fileName
				: typeof binaryData?.file === 'string'
					? binaryData.file
					: propertyName;
		const attributes = new Evernote.Types.ResourceAttributes({
			fileName: fileNameValue,
		});
		const resource = new Evernote.Types.Resource({
			data,
			mime,
			attributes,
		});
		resources.push(resource);
		mediaTags.push(`<en-media type="${mime}" hash="${bodyHash.toString('hex')}" />`);
	}
	return { resources, mediaTags };
};

export const parseBinaryPropertyNames = (raw: string | undefined): string[] =>
	raw
		?.split(',')
		.map((name) => name.trim())
		.filter((name) => name.length > 0) ?? [];

export const transformNote = (note: EvernoteNote): IDataObject => {
	const response = note as unknown as IDataObject;
	if (note.contentHash) {
		response.contentHash = Buffer.from(note.contentHash).toString('hex');
	}
	return response;
};
