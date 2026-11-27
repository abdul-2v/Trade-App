// Keep the database's full timestamp precision and unique id in every history cursor.
type HistoryRow={created_at:string;id:string|number};
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/i;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function historyBefore(row:HistoryRow):string{
 const stamp=row.created_at;
 const id=String(row.id);
 if(typeof stamp!=='string'||!timestamp.test(stamp)||!Number.isFinite(Date.parse(stamp))||
    !(uuid.test(id)||(/^\d+$/.test(id)&&Number.isSafeInteger(Number(id)))))
   throw new Error('Invalid history cursor');
 return `created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.${id})`;
}
export function compareHistory(a:HistoryRow,b:HistoryRow):number{
 const ms=Date.parse(a.created_at)-Date.parse(b.created_at);
 if(ms)return ms;
 const fraction=(s:string)=>Number((s.match(/\.(\d+)/)?.[1]||'').padEnd(6,'0').slice(3,6));
 const micros=fraction(a.created_at)-fraction(b.created_at);
 if(micros)return micros;
 if(typeof a.id==='number'&&typeof b.id==='number')return a.id-b.id;
 const left=String(a.id).toLowerCase(),right=String(b.id).toLowerCase();
 return left<right?-1:left>right?1:0;
}
