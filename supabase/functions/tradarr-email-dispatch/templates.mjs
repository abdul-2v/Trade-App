// Only fixed service copy: never render user-supplied notification bodies or private data.
const events=Object.freeze({
 job_offer:['New Tradarr job opportunity','A new job invitation is available. Sign in to review the request.'],
 job_accepted:['Your Tradarr job was accepted','A job request has been accepted. Open your workspace for the next steps.'],
 job_status:['Your Tradarr job has an update','The status of a job has changed. Sign in to review its latest progress.'],
 appointment:['Your Tradarr booking is confirmed','Your appointment has been confirmed. Sign in for the agreed details.'],
 appointment_change:['Your Tradarr booking has changed','There is a booking proposal or update. Check the latest information in Tradarr.'],
 appointment_reminder:['Your Tradarr appointment is coming up','A confirmed appointment is approaching. Check the latest booking details before travelling.'],
 quote_update:['Your Tradarr quote has an update','A quotation has been received or updated. Sign in to view the proposal and its status.'],
 invoice_update:['Your Tradarr invoice has an update','An invoice is available or has been updated. Sign in to view the document securely.'],
 message:['You have an unread Tradarr message','You have a conversation update. Sign in to read your messages privately.'],
 route_match:['A Tradarr journey opportunity is available','A route-related opportunity is available for your review.'],
 verification_update:['Your Tradarr verification has an update','There is an update to your account verification or credentials. Sign in to review it securely.'],
 support_update:['Your Tradarr support case has an update','There is an update to your support case. Sign in to read confidential details.'],
 admin_notice:['An important Tradarr account notice','There is an account-related notice waiting in your workspace.'],
 crew_update:['Your Tradarr Crew request has an update','There is an update to a Crew request or application. Sign in for details.']
});
export const emailKinds=Object.freeze(Object.keys(events));
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderEmail(kind,origin){
 if(!Object.hasOwn(events,kind))throw new Error('Unsupported event');
 if(typeof origin!=='string'||!/^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\/?$/i.test(origin))throw new Error('Verified HTTPS origin required');
 const url=origin.replace(/\/$/,'')+'/app';
 const [subject,body]=events[kind];
 const text=[subject,'',body,'','Open Tradarr: '+url,'','This is a service notification, not a promotional email. Never send passwords or payment details by email.'].join('\n');
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#F0F4F2;color:#102C30;font-family:Arial,Helvetica,sans-serif"><div style="max-width:580px;margin:0 auto;border:1px solid #DFE8E4;border-radius:20px;background:#fff;overflow:hidden"><div style="padding:24px 28px;font-weight:800;font-size:28px;border-bottom:1px solid #DFE8E4">tradarr<span style="color:#D97955">.</span></div><div style="padding:28px"><p style="font-size:12px;color:#28605D;font-weight:bold;letter-spacing:1px">ACCOUNT UPDATE</p><h1 style="font-size:25px;line-height:1.25;margin:12px 0">'+escapeHtml(subject)+'</h1><p style="font-size:16px;line-height:1.6;color:#50636A">'+escapeHtml(body)+'</p><a href="'+escapeHtml(url)+'" style="display:inline-block;background:#102C30;color:#fff;padding:15px 25px;border-radius:24px;text-decoration:none;font-weight:bold">Open Tradarr</a><p style="color:#50636A;font-size:12px;line-height:1.5;margin-top:25px">Never share your password, payment details or recovery codes by email.</p></div><div style="padding:16px 28px;background:#F0F4F2;font-size:12px;color:#50636A">Tradarr · Account service notification</div></div></body></html>';
 return {subject,text,html};
}
export function retryableStatus(status,code){return status===408||status===429||status>=500||(status===409&&code==='concurrent_idempotent_requests');}
