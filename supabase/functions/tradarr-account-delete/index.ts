import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'POST required'},405);
 const bearer=req.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer '))return json({error:'Sign-in required'},401);
 const token=bearer.slice(7).trim();
 if(!token)return json({error:'Sign-in required'},401);

 const url=Deno.env.get('SUPABASE_URL');
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!serviceKey||!anonKey)
  return json({error:'Privacy service is not configured'},503);
 const admin=createClient(url,serviceKey,{
  auth:{persistSession:false,autoRefreshToken:false},
 });
 const caller=createClient(url,anonKey,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{Authorization:'Bearer '+token}},
 });
 const {data:identity,error:identityError}=await admin.auth.getUser(token);
 if(identityError||!identity.user)return json({error:'Invalid session'},401);
 const staff=identity.user;
 if(staff.email_confirmed_at==null||staff.app_metadata?.tradarr_staff!==true)
  return json({error:'Administrator role required'},403);
 // This calls our Postgres auth.users + JWT aal2 gate, rather than trusting
 // user-mutable metadata or a caller-provided role.
 const {error:staffAuthError}=await caller.rpc('tradarr_admin_dashboard');
 if(staffAuthError)return json({error:'Authenticator verification required'},403);

 let body:Record<string,unknown>;
 try{
  const candidate=await req.json();
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))
   return json({error:'Invalid request'},400);
  body=candidate as Record<string,unknown>;
 }catch{return json({error:'Invalid JSON body'},400);}
 const id=typeof body.request_id==='string'?body.request_id.trim():'';
 if(!UUID.test(id))return json({error:'Invalid deletion request ID'},400);
 const checkOnly=body.check_only===true;

 const {data:request,error:requestError}=await admin.from('tradarr_account_deletion_requests')
  .select('id,user_id,status').eq('id',id).maybeSingle();
 if(requestError)return json({error:'Could not verify deletion request'},503);
 if(!request)return json({error:'Deletion request not found'},404);
 if(staff.id===request.user_id)return json({error:'Staff accounts cannot delete themselves'},403);
 if(request.status!=='ready_for_deletion')
  return json({error:'The deletion request is not approved for final processing'},409);

 const {data:preflight,error:preflightError}=await admin.rpc('tradarr_deletion_preflight',{
  p_request_id:id
 });
 if(preflightError||!preflight)
  return json({error:'Could not complete mandatory retention checks'},503);
 const permitted=preflight as {eligible?:boolean;blockers?:string[];user_id?:string};
 if(permitted.user_id!==request.user_id)
  return json({error:'Deletion request changed: retry review'},409);
 if(checkOnly)
  return json({
   eligible:permitted.eligible===true,
   blockers:permitted.blockers||[],
   user_id_prefix:request.user_id.slice(0,8).toUpperCase(),
  });
 if(!permitted.eligible){
  return json({
   error:'Automated deletion blocked until data obligations are reviewed',
   blockers:permitted.blockers||[],
  },409);
 }
 const typed=typeof body.confirmation==='string'?body.confirmation:'';
 if(typed!=='DELETE '+request.user_id.slice(0,8).toUpperCase())
  return json({error:'Confirmation phrase did not match target account'},400);

 // Log the irreversible attempt BEFORE deletion. If audit fails we abort.
 const {error:auditStartError}=await admin.from('tradarr_admin_audit').insert({
  actor_id:staff.id,action:'account_delete_started',target_type:'user',target_id:request.user_id,
  reason:'Approved, retention-checked request '+id,
  metadata:{request_id:id,source:'admin_gateway',phase:'started'}
 });
 if(auditStartError)return json({error:'Audit unavailable; deletion was not attempted'},503);
 // Recheck as close to the Auth deletion as the two services permit.
 const {data:finalCheck,error:finalError}=await admin.rpc('tradarr_deletion_preflight',{
  p_request_id:id
 });
 if(finalError||!finalCheck||(finalCheck as {eligible?:boolean}).eligible!==true)
  return json({error:'Retention status changed; deletion cancelled'},409);
 const {error:deleteError}=await admin.auth.admin.deleteUser(request.user_id);
 if(deleteError){
  await admin.from('tradarr_admin_audit').insert({
   actor_id:staff.id,action:'account_delete_failed',target_type:'user',target_id:request.user_id,
   reason:'Approved deletion failed after retention preflight',
   metadata:{request_id:id,error_code:deleteError.status||500}
  });
  return json({error:'Auth deletion was not completed. Preserve the request and review retained records.'},503);
 }
 // The request itself cascades away with auth.users. The immutable audit lives on.
 const {error:finalAuditError}=await admin.from('tradarr_admin_audit').insert({
  actor_id:staff.id,action:'account_deleted',target_type:'user',target_id:request.user_id,
  reason:'Completed approved, retention-checked account deletion',
  metadata:{request_id:id,source:'admin_gateway'}
 });
 if(finalAuditError)console.error('Account deletion succeeded but completion audit failed',id);
 return json({deleted:true,audit_recorded:!finalAuditError});
});