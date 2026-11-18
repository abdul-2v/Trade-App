/** Decode ImagePicker JPEG/PNG/WebP base64 into bytes without Blob/FormData,
 * which are unreliable for uploads from native React Native.
 */
const TABLE='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function decodeChatPhotoBase64(base64:string):Uint8Array{
 const src=base64.replace(/\s/g,'');
 if(!src || src.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(src))
  throw new Error('The selected image was not readable.');
 const pad=src.endsWith('==')?2:src.endsWith('=')?1:0;
 const length=(src.length/4)*3-pad;
 if(length<1||length>8*1024*1024)
  throw new Error('Choose a photo smaller than 8MB.');
 const bytes=new Uint8Array(length);
 let j=0;
 for(let i=0;i<src.length;i+=4){
  const a=TABLE.indexOf(src[i]),b=TABLE.indexOf(src[i+1]);
  const c=src[i+2]==='='?0:TABLE.indexOf(src[i+2]);
  const d=src[i+3]==='='?0:TABLE.indexOf(src[i+3]);
  if(a<0||b<0||c<0||d<0)throw new Error('Unable to decode this image.');
  const n=(a<<18)|(b<<12)|(c<<6)|d;
  if(j<length)bytes[j++]=(n>>16)&255;
  if(j<length)bytes[j++]=(n>>8)&255;
  if(j<length)bytes[j++]=n&255;
 }
 return bytes;
}
export type ChatPhotoMime='image/jpeg'|'image/png'|'image/webp';
/** Check decoded image magic bytes rather than trusting the filename or picker MIME. */
export function detectChatPhotoMime(base64:string):ChatPhotoMime {
 const clean=base64.replace(/\s/g,'');
 if(clean.startsWith('/9j/'))return 'image/jpeg';
 if(clean.startsWith('iVBORw0KGgo'))return 'image/png';
 if(clean.startsWith('UklGR')) {
   const first=decodeChatPhotoBase64(clean.slice(0,24));
   const riff=String.fromCharCode(...first.slice(0,4));
   const webp=String.fromCharCode(...first.slice(8,12));
   if(riff==='RIFF'&&webp==='WEBP')return 'image/webp';
 }
 throw new Error('This image format is not supported. Choose a JPEG, PNG or WebP photo.');
}
export function chatPhotoPath(conversationId:string,senderId:string,token:string,mime:ChatPhotoMime='image/jpeg'){
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 if(!uuid.test(conversationId)||!uuid.test(senderId)||!uuid.test(token))
  throw new Error('Invalid photo upload identifiers.');
 const ext=mime==='image/png'?'.png':mime==='image/webp'?'.webp':'.jpg';
 return conversationId+'/'+senderId+'/'+token+ext;
}
