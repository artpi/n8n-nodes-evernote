# n8n-nodes-evernote

This is an n8n community node for Evernote. It lets you create, read, update, delete, and search notes, plus list notebooks and tags using an Evernote developer token.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

- **Note**: create, read (ENML or HTML), update (replace or append), delete, search (metadata by default, optional full notes).
- **Notebook**: list notebooks (name, GUID, stack, default flag).
- **Tag**: list tags (name, GUID, parent GUID).

## Credentials

- Use an Evernote developer token (personal access token). Add it to the `Evernote API` credential in n8n.
- Toggle **Use Sandbox** if your token targets the Evernote sandbox environment.

## Compatibility

Node 24.x is required. Use `nvm use` (with the provided `.nvmrc`) or your version manager of choice before installing to satisfy the `engines` and `engine-strict` checks.

## Usage

- **Content formats**: choose Plain Text (wrapped in ENML) or HTML (sanitized to ENML). When reading, you can request raw ENML or simplified HTML.
- **Update modes**: replace overwrites content; append pulls the current note, adds your new content at the end, and saves.
- **Attachments**: enable “Add Attachments” and list binary property names (comma-separated). Attachments are hashed (MD5) and injected as `<en-media>` in the note.
- **Search**: uses Evernote search grammar. Defaults to metadata; enable “Full Notes” to fetch complete notes.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* _Link to app/service documentation._

## Version history

_This is another optional section. If your node has multiple versions, include a short description of available versions and what changed, as well as any compatibility impact._
