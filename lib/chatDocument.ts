import {File} from 'expo-file-system';

export const CHAT_DOCUMENT_LIMIT=8*1024*1024;
export type ChatDocumentMime='application/pdf'|
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function chatDocumentMime(filename:string):ChatDocumentMime {
 const extension=filename.toLowerCase().trim();
 if(extension.endsWith('.pdf'))return 'application/pdf';
 if(extension.endsWith('.docx'))return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 throw new Error('Choose a PDF or Word (.docx) document.');
}
export function safeChatDocumentName(name:string):string{
 const cleaned=name.replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
 return cleaned||'Document';
}
export function chatDocumentPath(conversationId:string,senderId:string,token:string,mime:ChatDocumentMime){
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 if(!uuid.test(conversationId)||!uuid.test(senderId)||!uuid.test(token))
  throw new Error('Invalid attachment identifiers.');
 return conversationId+'/'+senderId+'/'+token+
  (mime==='application/pdf'?'.pdf':'.docx');
}
/** Bytes (not user-supplied name/MIME) determine the accepted file format. */
export async function readChatDocument(uri:string,mime:ChatDocumentMime):Promise<Uint8Array>{
 const file=new File(uri);
 if(file.size<4||file.size>CHAT_DOCUMENT_LIMIT)
  throw new Error('Document must be smaller than 8 MB.');
 const bytes=await file.bytes();
 if(!bytes.length||bytes.length>CHAT_DOCUMENT_LIMIT)
  throw new Error('Document must be smaller than 8 MB.');
 const isPdf=bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
 const isZip=bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4;
 if(mime==='application/pdf'&&!isPdf)throw new Error('The selected file is not a valid PDF.');
 if(mime!=='application/pdf'&&!isZip)throw new Error('The selected file is not a valid Word document.');
 return bytes;
}
