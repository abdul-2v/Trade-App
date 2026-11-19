import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {Linking} from 'react-native';
import {supabase} from './supabase';

export type SupportEvidence={
 id:string;case_id:string;uploader_id:string;file_path:string;file_name:string;
 mime_type:string;created_at:string;
};

function sniffDocument(bytes:Uint8Array):{ext:string;mime:string}{
 if(bytes.length>=5&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45)
  return {ext:'pdf',mime:'application/pdf'};
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
  return {ext:'jpg',mime:'image/jpeg'};
 if(bytes.length>=8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)
  return {ext:'png',mime:'image/png'};
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
   String.fromCharCode(...bytes.slice(8,12))==='WEBP')
  return {ext:'webp',mime:'image/webp'};
 throw new Error('Choose a valid PDF, JPEG, PNG or WebP document.');
}

export async function uploadSupportEvidence(
 caseId:string,userId:string,
):Promise<SupportEvidence|null>{
 const result=await DocumentPicker.getDocumentAsync({
  type:['application/pdf','image/jpeg','image/png','image/webp'],
  copyToCacheDirectory:true,multiple:false
 });
 if(result.canceled||!result.assets?.[0])return null;
 const asset=result.assets[0];
 const file=new File(asset.uri);
 if(file.size<8||file.size>8*1024*1024)throw new Error('Select a document under 8 MB.');
 const bytes=await file.bytes();
 if(bytes.length<8||bytes.length>8*1024*1024)throw new Error('Select a document under 8 MB.');
 const {ext,mime}=sniffDocument(bytes);
 const name=String(asset.name||'Case evidence').replace(/[\r\n\t]/g,' ').trim().slice(0,120);
 const token=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);
 const path=caseId+'/'+userId+'/'+token+'.'+ext;
 const {error:uploadError}=await supabase.storage.from('tradarr-support-evidence')
  .upload(path,bytes,{contentType:mime,upsert:false});
 if(uploadError)throw uploadError;
 const {data,error:saveError}=await supabase.from('support_case_evidence')
  .insert({case_id:caseId,uploader_id:userId,file_path:path,file_name:name,mime_type:mime})
  .select('id,case_id,uploader_id,file_path,file_name,mime_type,created_at').single();
 if(saveError||!data){
  await supabase.storage.from('tradarr-support-evidence').remove([path]);
  throw saveError||new Error('Could not save evidence to the case.');
 }
 return data as SupportEvidence;
}
export async function openSupportEvidence(filePath:string):Promise<void>{
 const {data,error}=await supabase.storage.from('tradarr-support-evidence')
  .createSignedUrl(filePath,180);
 if(error||!data?.signedUrl)throw error||new Error('Private evidence is unavailable.');
 await Linking.openURL(data.signedUrl);
}
