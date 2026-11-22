/** Scheduling dates are interpreted in the UK time zone, never the phone's time zone. */
export const UK_ZONE = 'Europe/London';

function londonParts(date:Date) {
  const pieces = new Intl.DateTimeFormat('en-GB',{
    timeZone:UK_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  const read=(type:string)=>pieces.find(p=>p.type===type)?.value||'';
  return { day:read('year')+'-'+read('month')+'-'+read('day'),
    time:read('hour')+':'+read('minute') };
}

export function ukDayOf(date:Date) { return londonParts(date).day; }

export function nextUKDays(count=7, now=new Date()) {
  // Iterate civil calendar days, not 24-hour elapsed periods. During spring
  // forward, adding 86,400,000ms near midnight can skip the next UK day.
  const today=ukDayOf(now);
  const days:string[]=[];
  for(let i=0;i<Math.max(0,count);i++){
    const day=new Date(today+'T12:00:00Z');
    day.setUTCDate(day.getUTCDate()+i);
    days.push(day.toISOString().slice(0,10));
  }
  return days;
}

export function ukSlotToISO(date:string,time:string):string|null {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
  const [y,m,d]=date.split('-').map(Number);
  const [hh,mm]=time.split(':').map(Number);
  if(m<1||m>12||d<1||d>31)return null;
  const valid=new Date(Date.UTC(y,m-1,d));
  if(valid.getUTCFullYear()!==y||valid.getUTCMonth()!==m-1||valid.getUTCDate()!==d)return null;
  // UK local time is UTC or UTC+1; choose a valid instant after round-tripping.
  const candidates=[1,0].map(offset=>new Date(Date.UTC(y,m-1,d,hh-offset,mm)));
  const found=candidates.find(candidate=>{
    const parsed=londonParts(candidate);
    return parsed.day===date&&parsed.time===time;
  });
  return found?.toISOString()||null;
}

export function formatUKDateTime(iso:string) {
  return new Date(iso).toLocaleString('en-GB',{
    timeZone:UK_ZONE,weekday:'short',day:'numeric',month:'short',
    hour:'2-digit',minute:'2-digit'
  });
}

export function advanceISOByMinutes(start:string,minutes:number) {
  const ms=Date.parse(start);
  if(!Number.isFinite(ms)||!Number.isInteger(minutes)||minutes<15||minutes>720)return null;
  return new Date(ms+minutes*60000).toISOString();
}

export const APPOINTMENT_TIMES=['08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00'];
export const APPOINTMENT_LENGTHS=[30,60,90,120,180];
