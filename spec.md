# Evernote Node Specification

## 1. Overview
This document outlines the specifications for a custom n8n node for Evernote. The node will allow users to interact with their Evernote account to manage notes, notebooks, and tags.

## 2. Authentication
*   **Method**: Developer Token (Personal Access Token).
*   **Implementation**: The node will use a custom credential type (e.g., `evernoteApi`) requiring a `accessToken` field.
*   **Future**: OAuth 1.0a support can be added later.

## 3. Resources & Operations

### 3.1. Note
The primary resource for this node.
*   **Create**: Create a new note.
    *   Inputs: Title, Content, Notebook (optional), Tags (optional), Attachments (optional).
*   **Read**: Get a note by GUID.
    *   Outputs: Title, Content (HTML/ENML), Attributes, Resource Metadata.
*   **Update**: Update an existing note.
    *   Inputs: Note GUID, Title, Content (Append/Replace), Tags.
*   **Delete**: Move a note to the trash.
    *   Inputs: Note GUID.
*   **Search**: Find notes using Evernote's search grammar.
    *   Inputs: Search Query (e.g., `tag:finance`), Notebook GUID (optional).
    *   Outputs: List of note metadata (GUID, Title, Created Date, etc.).

### 3.2. Notebook
Read-only access to organize notes.
*   **List**: Get all notebooks.
    *   Outputs: Name, GUID, Stack, Default status.

### 3.3. Tag
Read-only access to organize notes.
*   **List**: Get all tags.
    *   Outputs: Name, GUID, Parent GUID.

## 4. Feature Details

### 4.1. Content Handling (ENML)
Evernote uses ENML (Evernote Markup Language). The node will abstract this complexity.
*   **Input Mode**: The user can select the content format:
    *   **Plain Text**: The node wraps the text in `<en-note><div>...</div></en-note>`.
    *   **HTML**: The node sanitizes the HTML and converts it to valid ENML using `sanitize-html` (MIT).
        *   We will implement a helper `htmlToEnml(html: string): string` that:
            1.  Uses `sanitize-html` with a strict allowlist matching the [Evernote ENML DTD](http://xml.evernote.com/pub/enml2.dtd).
            2.  Configures the parser to produce XHTML (self-closing tags like `<br />`).
            3.  Wraps the result in `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>...</en-note>`.
            4.  This ensures the output is valid XML and complies with Evernote's requirements.
*   **Output**: When reading a note, the node should offer to return the raw ENML or a simplified HTML version.

### 4.2. Attachments
*   **Input**: The node will accept binary data from n8n's binary input.
*   **Processing**: The node will calculate the MD5 hash (required by Evernote) and create the `Resource` object to attach to the note.

## 5. Technical Implementation
*   **SDK**: `evernote` (npm package).
*   **Protocol**: Thrift (handled by SDK).
*   **Sandbox**: The node should have a toggle or environment detection for Sandbox vs. Production (though Developer Tokens are usually environment-specific).

## 6. User Stories
1.  **As a user**, I want to create a daily journal note from a template so that I can log my activities.
2.  **As a user**, I want to search for all notes tagged "receipt" created this month so that I can process expenses.
3.  **As a user**, I want to append a new line of text to an existing note so that I can keep a running log.
4.  **As a user**, I want to upload a PDF invoice to a specific notebook so that I can archive it.
5.  **As a user**, I want to list all my notebooks so I can dynamically select where to put a new note.
