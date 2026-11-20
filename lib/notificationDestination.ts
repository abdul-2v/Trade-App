/** Only route notifications returned by the signed-in user's Supabase
 * notification lookup. Never navigate directly from untrusted push payload. */
export type NotificationMode='customer'|'tradesperson'|'crew';
export type NotificationTarget={
 mode:NotificationMode;
 screen:string;
 conversationId:string|null;
 activity:boolean;
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function resolveNotificationTarget(
  mode:NotificationMode,
  kind:string,
  data:unknown
):NotificationTarget{
  const fields=data&&typeof data==='object'&&!Array.isArray(data)?
    data as Record<string,unknown>:{};
  const conversationId=typeof fields.conversationId==='string'&&uuid.test(fields.conversationId)?
    fields.conversationId:null;
  if(mode==='crew')return {mode,screen:'crew',conversationId:null,activity:false};
  if(mode==='customer'){
    if(kind==='message')return {mode,screen:'messages',conversationId,activity:false};
    if(kind==='admin_notice')return {mode,screen:'messages',conversationId:null,activity:true};
    if(fields.screen==='accountSafety')return {mode,screen:'customerSafety',conversationId:null,activity:false};
    if(kind==='support_update')return {mode,screen:'customerSupport',conversationId:null,activity:false};
    if(kind==='invoice_update')return {mode,screen:'customerInvoices',conversationId:null,activity:false};
    if(kind==='quote_update')return {mode,screen:'customerQuotes',conversationId:null,activity:false};
    return {mode,screen:'requests',conversationId:null,activity:false};
  }
  if(kind==='message')return {mode,screen:'tradeMessages',conversationId,activity:false};
  if(kind==='admin_notice')return {mode,screen:'tradeMessages',conversationId:null,activity:true};
  if(fields.screen==='accountSafety')return {mode,screen:'tradeSafety',conversationId:null,activity:false};
  if(kind==='support_update')return {mode,screen:'tradeSupport',conversationId:null,activity:false};
  if(kind==='verification_update')return {mode,screen:'tradeTrust',conversationId:null,activity:false};
  if(kind==='crew_update')return {mode,screen:'tradeCrew',conversationId:null,activity:false};
  if(kind==='invoice_update')return {mode,screen:'tradeInvoices',conversationId:null,activity:false};
  if(kind==='quote_update')return {mode,screen:'tradeQuotes',conversationId:null,activity:false};
  if(kind==='appointment'||kind==='appointment_change'||kind==='appointment_reminder')
   return {mode,screen:'tradeDiary',conversationId:null,activity:false};
  if(kind==='route_match')return {mode,screen:'tradeRoutes',conversationId:null,activity:false};
  return {mode,screen:'tradeJobs',conversationId:null,activity:false};
}
