// Traffic-aware road route previews for the route owner only.
// Private job coordinates and Google credentials never reach other app users.
// Requires GOOGLE_ROUTES_API_KEY in Supabase Edge Function secrets.
// Set a hard daily quota in Google Cloud before enabling production traffic.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

type Coords = {latitude:number; longitude:number};
type Stop = {id:string;start:number;end:number;latitude:number;longitude:number};
type RouteResult = {
  distanceMeters:number; duration:string; legs?:Array<{duration:string}>;
  optimizedIntermediateWaypointIndex?:number[];
};
const headers = {'Content-Type':'application/json','Cache-Control':'no-store'};
function respond(status:number, payload:Record<string,unknown>) {
  return new Response(JSON.stringify(payload),{status,headers});
}
function validUK(point:unknown):point is Coords {
  const p=point as Coords | undefined;
  return p!=null && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    && p.latitude>=49 && p.latitude<=61 && p.longitude>=-9 && p.longitude<=3;
}
function seconds(duration:unknown):number {
  if(typeof duration!=='string'||!/^\d+(?:\.\d+)?s$/.test(duration))throw Error('Invalid route duration');
  return Number(duration.slice(0,-1));
}
function point(p:Coords) {
  return {location:{latLng:{latitude:p.latitude,longitude:p.longitude}}};
}
function feasible(order:number[],legs:RouteResult['legs'],stops:Stop[],depart:number) {
  if(!legs||legs.length!==order.length)return false;
  let at=depart;
  for(let i=0;i<order.length;i++){
    const stop=stops[order[i]],duration=seconds(legs[i].duration)*1000;
    at+=duration;
    // A confirmed time cannot be moved silently, even if another order is shorter.
    if(!Number.isFinite(at)||at>stop.start)return false;
    at=Math.max(at,stop.start)+(stop.end-stop.start)+15*60000;
  }
  return true;
}
Deno.serve(async req=>{
  if(req.method!=='POST')return respond(405,{error:'POST required'});
  const bearer=req.headers.get('Authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(bearer))return respond(401,{error:'Sign in to calculate a route'});
  const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
  if(!supabaseUrl||!anonKey)return respond(503,{error:'Route service is not configured'});
  const client=createClient(supabaseUrl,anonKey,{
    global:{headers:{Authorization:bearer}},
    auth:{autoRefreshToken:false,persistSession:false}
  });
  const token=bearer.replace(/^Bearer\s+/i,'');
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user)return respond(401,{error:'Your session expired. Sign in again'});
  let body:Record<string,unknown>;
  try{body=await req.json();}catch{return respond(400,{error:'Invalid route request'});}
  const planId=body.planId;
  if(typeof planId!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(planId))
    return respond(400,{error:'Invalid journey'});
  // All reads are performed with the caller's JWT so database RLS remains in force.
  const {data:plan,error:planError}=await client.from('trade_route_plans')
    .select('id,mode,status,tradesperson_id,anchor_appointment_id,starts_at,start_latitude,start_longitude')
    .eq('id',planId).eq('tradesperson_id',user.id).maybeSingle();
  if(planError)return respond(503,{error:'Could not check your journey'});
  if(!plan||plan.status==='closed')return respond(404,{error:'Journey not available'});
  const {data:anchor,error:anchorError}=await client.from('trade_appointments')
    .select('id,address,starts_at,status,tradesperson_id').eq('id',plan.anchor_appointment_id)
    .eq('tradesperson_id',user.id).maybeSingle();
  if(anchorError||!anchor||anchor.status!=='scheduled')
    return respond(409,{error:'The anchor appointment is no longer confirmed'});
  const {data:offers,error:offerError}=await client.from('job_offers')
    .select('job_id').eq('route_plan_id',plan.id).eq('tradesperson_id',user.id)
    .eq('status','accepted').limit(5);
  if(offerError)return respond(503,{error:'Could not check the accepted visits'});
  const acceptedIds=[...new Set((offers||[]).map(o=>o.job_id))].slice(0,4);
  if(!acceptedIds.length)return respond(409,{error:'No accepted visits to calculate'});
  const [{data:jobs,error:jobError},{data:locations,error:locationError}]=await Promise.all([
    client.from('jobs').select('id,status,accepted_tradesperson_id,appointment_id,requested_start,requested_end')
      .in('id',acceptedIds).eq('accepted_tradesperson_id',user.id),
    client.from('job_locations').select('job_id,latitude,longitude').in('job_id',acceptedIds)
  ]);
  if(jobError||locationError)return respond(503,{error:'Could not load confirmed visit locations'});
  const byLocation=new Map((locations||[]).map(l=>[l.job_id,l]));
  const stops:Stop[]=(jobs||[]).filter(j=>j.appointment_id&&j.requested_start&&j.requested_end
    &&!['cancelled','completed'].includes(j.status)).flatMap(j=>{
      const loc=byLocation.get(j.id);
      if(!loc||!validUK(loc))return [];
      const start=Date.parse(j.requested_start),end=Date.parse(j.requested_end);
      if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
      return [{id:j.id,start,end,latitude:loc.latitude,longitude:loc.longitude}];
    }).sort((a,b)=>a.start-b.start);
  if(stops.length!==acceptedIds.length)
    return respond(409,{error:'Confirm the time and exact address of every accepted visit first'});
  if(stops.length>4||plan.mode==='on_my_way'&&stops.length!==1)
    return respond(409,{error:'Journey exceeds its safe visit capacity'});
  const area={latitude:Number(plan.start_latitude),longitude:Number(plan.start_longitude)};
  const preciseOrigin=validUK(body.origin)?body.origin as Coords:null;
  if(!preciseOrigin&&!validUK(area))
    return respond(409,{error:'Journey needs a valid starting area'});
  if(plan.mode==='on_my_way'&&(!anchor.address||anchor.address.trim().length<7))
    return respond(409,{error:'Add the original appointment address in your diary'});
  const key=Deno.env.get('GOOGLE_ROUTES_API_KEY');
  if(!key)return respond(503,{error:'Live road routing is not configured yet. Use Maps directions for now'});
  // Cost protection: only this server has a service-role credential. The public
  // app cannot call the quota RPC, forge paid usage or read its counters.
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!serviceKey)return respond(503,{error:'Road routing security is not configured'});
  const service=createClient(supabaseUrl,serviceKey,{
    auth:{autoRefreshToken:false,persistSession:false}
  });
  const {data:admitted,error:quotaError}=await service.rpc('tradarr_consume_road_route_quota',{
    p_user_id:user.id
  });
  if(quotaError)return respond(503,{error:'Could not verify road-routing limits'});
  if(admitted!==true)return respond(429,{
    error:'Road-routing previews are limited to one per minute and 20 per day. Try again later. Google Maps directions still work.'
  });
  const origin=point(preciseOrigin||area);
  const destination=plan.mode==='on_my_way'
    ? {address:anchor.address+', United Kingdom'}
    : point(stops[stops.length-1]);
  const intermediates=(plan.mode==='on_my_way'?stops:stops.slice(0,-1)).map(point);
  const departure=Math.max(Date.now()+120000,Date.parse(plan.starts_at));
  const departures=new Date(departure).toISOString();
  const callRoutes=async(waypoints:unknown[],optimize:boolean):Promise<RouteResult>=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),11000);
    try{
      const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
        method:'POST',signal:controller.signal,
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,
          'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.legs.duration,routes.optimizedIntermediateWaypointIndex'},
        body:JSON.stringify({origin,destination,intermediates:waypoints,travelMode:'DRIVE',
          routingPreference:'TRAFFIC_AWARE',departureTime:departures,
          optimizeWaypointOrder:optimize})
      });
      if(!response.ok)throw Error('Road route provider unavailable');
      const data=await response.json();
      const result=data?.routes?.[0] as RouteResult|undefined;
      if(!result||!Number.isFinite(Number(result.distanceMeters)))throw Error('No road route found');
      seconds(result.duration);
      return result;
    }finally{clearTimeout(timeout);}
  };
  try{
    const ordinary=await callRoutes(intermediates,false);
    let chosen=ordinary;
    let order=stops.map((_,i)=>i);
    let reordered=false;
    // Google can suggest faster stop orders; accept ONLY when the existing
    // appointments and 15-minute buffers remain feasible, otherwise preserve time order.
    if(plan.mode==='street_run'&&stops.length>=3){
      try{
        const candidate=await callRoutes(intermediates,true);
        const idx=candidate.optimizedIntermediateWaypointIndex;
        if(Array.isArray(idx)&&idx.length===stops.length-1
          &&new Set(idx).size===idx.length&&idx.every(i=>Number.isInteger(i)&&i>=0&&i<stops.length-1)){
          const proposed=[...idx,stops.length-1];
          if(candidate.distanceMeters<ordinary.distanceMeters
             &&feasible(proposed,candidate.legs,stops,departure)){
             chosen=candidate;order=proposed;reordered=true;
          }
        }
      }catch{/* Keep the verified chronological route if optimization is unavailable. */}
    }
    let additionalMinutes:number|null=null;
    if(plan.mode==='on_my_way'){
      try{
        const baseline=await callRoutes([],false);
        additionalMinutes=Math.max(0,Math.round((seconds(chosen.duration)-seconds(baseline.duration))/60));
      }catch{/* No measured comparison means no detour claim. */}
    }
    return respond(200,{
      trafficAware:true,
      roadDistanceMiles:Number((chosen.distanceMeters/1609.344).toFixed(1)),
      drivingMinutes:Math.ceil(seconds(chosen.duration)/60),
      extraDrivingMinutes:additionalMinutes,
      stopOrder:order.map(i=>stops[i].id),
      scheduleFeasibleOptimization:reordered,
      originType:preciseOrigin?'current_device':'postcode_area',
      estimateOnly:true,
      pricingSavingsGBP:null,
      calculatedAt:new Date().toISOString()
    });
  }catch{
    return respond(503,{error:'Could not calculate a road route. Use Google Maps directions for now'});
  }
});
