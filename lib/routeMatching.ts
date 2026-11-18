/**
 * Tradarr matching for planned local work. Shortlisting uses coarse
 * straight-line geometry, NEVER driving times, prices or confirmed detours.
 */
export type RouteMode='on_my_way'|'street_run';
export type GeoPoint={latitude:number;longitude:number};
export type PublishedRoute={
 id:string;tradesperson_id:string;trade:string;mode:RouteMode;
 start_latitude:number;start_longitude:number;
 end_latitude:number;end_longitude:number;
 starts_at:string;ends_at:string;max_deviation_miles:number;
 status:string;max_extra_visits?:number;
};
export type RouteCandidate={plan:PublishedRoute;proximityMiles:number;why:string};
const RAD=Math.PI/180, EARTH_MI=3958.7613;
export function milesBetween(a:GeoPoint,b:GeoPoint):number{
 const p=(b.latitude-a.latitude)*RAD,l=(b.longitude-a.longitude)*RAD;
 const z=Math.sin(p/2)**2+Math.cos(a.latitude*RAD)*Math.cos(b.latitude*RAD)*Math.sin(l/2)**2;
 return 2*EARTH_MI*Math.asin(Math.min(1,Math.sqrt(z)));
}
/** Local metric projection; accurate enough for a *shortlist* in one UK region. */
export function distanceToRouteMiles(a:GeoPoint,b:GeoPoint,p:GeoPoint):number{
 const latScale=69.05;
 const lonScale=69.05*Math.cos(((a.latitude+b.latitude+p.latitude)/3)*RAD);
 const vx=(b.longitude-a.longitude)*lonScale,vy=(b.latitude-a.latitude)*latScale;
 const px=(p.longitude-a.longitude)*lonScale,py=(p.latitude-a.latitude)*latScale;
 const denom=vx*vx+vy*vy;
 const factor=denom<1e-10?0:Math.max(0,Math.min(1,(px*vx+py*vy)/denom));
 return Math.hypot(px-vx*factor,py-vy*factor);
}

export function rankPublishedRoutes(
 plans:PublishedRoute[],point:GeoPoint,trade:string,mode:RouteMode,
 latestAllowed:string,nowISO=new Date().toISOString(),maxResults=8
):RouteCandidate[]{
 const latest=Date.parse(latestAllowed), now=Date.parse(nowISO);
 if(!Number.isFinite(latest)||!Number.isFinite(now)||latest<=now)return [];
 return plans.flatMap((plan):RouteCandidate[]=>{
  const from=Date.parse(plan.starts_at),until=Date.parse(plan.ends_at);
  if(plan.status!=='open'||plan.mode!==mode||plan.trade!==trade||
    !Number.isFinite(from)||!Number.isFinite(until)||
    from<now||from>latest||until<=from)return [];
  const start={latitude:plan.start_latitude,longitude:plan.start_longitude};
  const end={latitude:plan.end_latitude,longitude:plan.end_longitude};
  if(![...Object.values(start),...Object.values(end),point.latitude,point.longitude]
    .every(Number.isFinite))return [];
  if(Math.abs(start.latitude)>90||Math.abs(end.latitude)>90||
    Math.abs(start.longitude)>180||Math.abs(end.longitude)>180)return [];
  const distance=mode==='on_my_way'
   ? distanceToRouteMiles(start,end,point)
   : milesBetween(end,point);
  const limit=Math.min(10,Math.max(0.5,Number(plan.max_deviation_miles)||3));
  if(distance>limit)return [];
  return [{plan,proximityMiles:Number(distance.toFixed(2)),
   why:mode==='on_my_way'?'Close to a published journey':'Close to a planned group of visits'}];
 }).sort((x,y)=>x.proximityMiles-y.proximityMiles).slice(0,maxResults);
}
