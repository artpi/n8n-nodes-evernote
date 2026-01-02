import { createHash } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Evernote = require('evernote');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml = require('sanitize-html');
import type { IExecuteFunctions } from 'n8n-workflow';

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
	return withoutProlog.replace(/<en-note([^>]*)>/i, '<div$1>').replace(/<\/en-note>/i, '</div>');
};

export interface ResourceBuildResult {
	resources: any[];
	mediaTags: string[];
}

export const buildResourcesFromBinary = async (
	executor: IExecuteFunctions,
	itemIndex: number,
	propertyNames: string[],
): Promise<ResourceBuildResult> => {
	const resources: any[] = [];
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
		const attributes = new Evernote.Types.ResourceAttributes({
			fileName: binaryData?.fileName || binaryData?.file || propertyName,
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
