export type HomePan={x:number;y:number};
const limit=(value:number,bound:number)=>Math.max(-bound,Math.min(bound,Number.isFinite(value)?value:0));
export const isHomePan=(dx:number,dy:number)=>Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.25;
export function clampHomePan(x:number,y:number,width:number,height:number):HomePan{return {x:limit(x,Math.max(0,width)*.25),y:limit(y,Math.max(0,height)*.065)};}
export function settleHomePan(position:HomePan,velocity:HomePan,width:number,height:number):HomePan{return clampHomePan(position.x+limit(velocity.x,1.25)*110,position.y+limit(velocity.y,.4)*75,width,height);}
