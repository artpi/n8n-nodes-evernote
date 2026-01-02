import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class EvernoteApi implements ICredentialType {
	name = 'evernoteApi';
	displayName = 'Evernote API';
	documentationUrl = 'https://dev.evernote.com/doc/';
	icon: Icon = { light: 'file:evernote.svg', dark: 'file:evernote.dark.svg' };
	testedBy = ['evernote'];
	test = {
		request: {
			baseURL: 'https://www.evernote.com',
			url: '/',
		},
	};
	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			description: 'Evernote developer token (personal access token)',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Use Sandbox',
			description: 'Whether to target the Evernote sandbox environment',
			name: 'useSandbox',
			type: 'boolean',
			default: false,
		},
	];
}
