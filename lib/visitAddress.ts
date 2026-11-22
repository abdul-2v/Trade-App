/** Visit navigation must never silently use a postcode centroid or approximate GPS.
 * Actual addresses are stored on the private linked diary appointment only.
 * This tests formatting, not whether the customer genuinely confirmed the address.
 */
const UK_FULL_POSTCODE=/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
export function hasFullVisitAddress(value:string|null|undefined):boolean{
 if(typeof value!=='string')return false;
 const address=value.trim().replace(/\s+/g,' ');
 if(address.length<14||address.length>300)return false;
 if(/\b(?:postcode approximation|approximate area|confirm property address|unknown address)\b/i.test(address))
  return false;
 const match=UK_FULL_POSTCODE.exec(address);
 if(!match)return false;
 const before=address.slice(0,match.index).replace(/[,.;]+/g,' ').trim();
 return before.length>=7&&before.split(/\s+/).filter(Boolean).length>=2;
}
export function visitAddressDirectionsUrl(address:string|null|undefined):string|null{
 if(!hasFullVisitAddress(address))return null;
 return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+
  encodeURIComponent((address||'').trim())+'&dir_action=navigate';
}
