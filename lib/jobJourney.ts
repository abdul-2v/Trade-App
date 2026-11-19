import {supabase} from './supabase';

/** A manual journey estimate, not calculated driving time or live GPS tracking. */
export const ARRIVAL_ETA_PRESETS=[10,15,20,30,45,60] as const;

export async function shareJobArrivalEstimate(args:{
  jobId:string;tradespersonId:string;status:string;minutes:number;
}):Promise<void>{
 const {jobId,tradespersonId,status,minutes}=args;
 if(!['accepted','en_route'].includes(status))
  throw new Error('Refresh the job before setting an arrival estimate.');
 if(!ARRIVAL_ETA_PRESETS.includes(minutes as typeof ARRIVAL_ETA_PRESETS[number]))
  throw new Error('Choose one of the listed arrival estimates.');
 if(!jobId||!tradespersonId)throw new Error('Sign in before updating a job.');

 const change=status==='accepted'
  ?{status:'en_route',estimated_arrival_minutes:minutes,updated_at:new Date().toISOString()}
  :{estimated_arrival_minutes:minutes,updated_at:new Date().toISOString()};
 const {data,error}=await supabase.from('jobs').update(change)
  .eq('id',jobId).eq('accepted_tradesperson_id',tradespersonId)
  .eq('status',status).select('id').maybeSingle();
 if(error||!data)throw new Error(error?.message||
  'The job has changed or the slot was not confirmed. Refresh and try again.');
}

export function etaAgeLabel(updatedAt?:string|null):string{
 if(!updatedAt)return 'Recently updated';
 const age=Math.max(0,Math.floor((Date.now()-Date.parse(updatedAt))/60000));
 if(!Number.isFinite(age))return 'Recently updated';
 return age<1?'Updated just now':age===1?'Updated 1 minute ago':`Updated ${age} minutes ago`;
}
