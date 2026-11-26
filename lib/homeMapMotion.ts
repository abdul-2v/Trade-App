export const HOME_MAP_TRAVEL=.25;
export const clampHomePage=(value:number)=>Number.isFinite(value)?Math.max(-1,Math.min(1,Math.round(value))):0;
export const stepHomePage=(page:number,direction:number)=>clampHomePage(clampHomePage(page)+(direction>0?1:direction<0?-1:0));
