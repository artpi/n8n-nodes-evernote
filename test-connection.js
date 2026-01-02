import 'dotenv/config';
import Evernote from 'evernote';

const token = process.env.EVERNOTE_DEV_TOKEN;

const client = new Evernote.Client( {
  token: token,
  sandbox: false
});
var noteStore = client.getNoteStore();
noteStore.listNotebooks().then(function(notebooks) {
  console.log('Notebooks:', notebooks);
});

var filter = new Evernote.NoteStore.NoteFilter({
  words: '202512',
  ascending: true
});
var spec = new Evernote.NoteStore.NotesMetadataResultSpec({
  includeTitle: true,
  includeContentLength: true,
  includeCreated: true,
  includeUpdated: true,
  includeDeleted: true,
  includeUpdateSequenceNum: true,
  includeNotebookGuid: true,
  includeTagGuids: true,
  includeAttributes: true,
  includeLargestResourceMime: true,
  includeLargestResourceSize: true,
});

noteStore.findNotesMetadata(filter, 0, 500, spec).then(function(notesMetadataList) {
 console.log('NotesMetadataList:', notesMetadataList);
});