/**
 * Reserve at most two visibly sponsored positions without disguising them as
 * organic "nearest" or "highest rated" results. All eligibility and purchased
 * status comes from the RLS-protected marketplace read model; the client is
 * responsible only for presentation.
 */
export type MapPromotionCandidate={
 id:string;promoted?:boolean;distance:number;coverageDistanceMiles?:number;
};
export function splitPromotedNearby<T extends MapPromotionCandidate>(
 sortedOrganic:T[],demo:boolean,maxFeatured=2
):{featured:T[];organic:T[]}{
 if(demo||maxFeatured<=0)return {featured:[],organic:sortedOrganic};
 const featured=sortedOrganic.filter(t=>t.id.startsWith('live-')&&t.promoted===true)
   .sort((a,b)=>(a.coverageDistanceMiles??a.distance)-
                (b.coverageDistanceMiles??b.distance))
   .slice(0,Math.min(2,Math.max(0,maxFeatured)));
 const ids=new Set(featured.map(t=>t.id));
 return {featured,organic:sortedOrganic.filter(t=>!ids.has(t.id))};
}
