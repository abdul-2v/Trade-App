export type PlanMode='budget'|'hire'|'snags';
export type PlanRow={id:string;label:string;estimated:string;paid:string;done:boolean};
export type Plan={title:string;limit:string;contingency:number;rows:PlanRow[]};
export function moneyPence(value:string):number|null{
 const text=value.trim();if(!text)return 0;
 if(!/^\d{1,9}(?:\.\d{0,2})?$/.test(text))return null;
 const [p,d='']=text.split('.');
 return Number(p)*100+Number(d.padEnd(2,'0'));
}
export function budgetSummary(p:Plan){
 const limit=moneyPence(p.limit);if(limit===null)return null;
 let estimated=0,paid=0;
 for(const row of p.rows){const e=moneyPence(row.estimated),a=moneyPence(row.paid);if(e===null||a===null)return null;estimated+=e;paid+=a;}
 const reserve=Math.round(estimated*p.contingency/100),planned=estimated+reserve;
 return {limit,estimated,paid,reserve,planned,remaining:limit-planned};
}
const hireLabels=['Obtain an itemised written quote and compare alternatives','Check relevant qualifications or registration for the work','Ask for evidence of appropriate insurance','Agree the work included, exclusions and materials in writing','Agree dates, payment stages and how extra work is approved','Agree how defects and completion will be handled','Confirm certificates, receipts or warranties needed at handover'];
export function initialPlan(mode:PlanMode):Plan{
 return {title:'',limit:'',contingency:10,rows:(mode==='hire'?hireLabels:[]).map((label,i)=>({id:'check-'+i,label,estimated:'',paid:'',done:false}))};
}
export function parsePlan(raw:string,mode:PlanMode):Plan{
 const p=JSON.parse(raw) as Plan;
 if(!p||typeof p.title!=='string'||typeof p.limit!=='string'||![0,5,10,15,20].includes(p.contingency)||!Array.isArray(p.rows)||p.rows.length>100)throw Error('Invalid plan');
 const ids=new Set<string>();
 for(const r of p.rows){if(!r||typeof r.id!=='string'||ids.has(r.id)||typeof r.label!=='string'||typeof r.estimated!=='string'||typeof r.paid!=='string'||typeof r.done!=='boolean')throw Error('Invalid plan item');ids.add(r.id);}
 return p;
}
