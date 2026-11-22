/** Shared UK postcode lookup for customer jobs, maps, and trader work areas.
 * The postcode is a search input; do not publish a precise property address.
 */
export type PostcodeResult={latitude:number;longitude:number;outcode:string;postcode?:string};
export async function lookupUkPostcode(value:string,limitMs=8500):Promise<PostcodeResult>{
 const code=String(value||'').trim().toUpperCase().replace(/\s+/g,'');
 const full=/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(code);
 const outcode=/^[A-Z]{1,2}\d[A-Z\d]?$/.test(code);
 if(!full&&!outcode)throw new Error('Enter a UK postcode or district such as LE1 or LE1 7RH.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),limitMs);
 try{
  const url='https://api.postcodes.io/'+(full?'postcodes':'outcodes')+'/'+encodeURIComponent(code);
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw new Error('That postcode was not found. Check the area and try again.');
  const result=(await response.json())?.result;
  if(!result||!Number.isFinite(Number(result.latitude))||
   !Number.isFinite(Number(result.longitude)))
   throw new Error('Postcode coordinates were unavailable. Try another postcode.');
  const latitude=Number(result.latitude),longitude=Number(result.longitude);
  if(Math.abs(latitude)>90||Math.abs(longitude)>180)
   throw new Error('Invalid postcode coordinates returned. Try again.');
  return {latitude,longitude,outcode:String(result.outcode||code.slice(0,-3)).toUpperCase(),
   ...(full?{postcode:code}: {})};
 }catch(error:any){
  if(error?.name==='AbortError')
   throw new Error('Postcode search timed out. Check your connection and try again.');
  if(error instanceof TypeError)
   throw new Error('Postcode search is unavailable. Check your connection and try again.');
  throw error;
 }finally{clearTimeout(timer)}
}
