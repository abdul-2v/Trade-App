export const HOME_TRADE_GROUPS=[['Plumber','Electrician','Builder'],['Heating','Carpenter','Locksmith']] as const;
export const nextHomeTradeGroup=(group:number)=>group===0?1:0;
