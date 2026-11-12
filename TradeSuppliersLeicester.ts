/**
 * Leicester launch-area directory cache (November 2026).
 * Branches checked against retailer directories / local business listings;
 * latitude and longitude are postcode centres, NOT precise shop doors.
 * Check stock and branch details before visiting.
 * Used only near Leicester when the live OpenStreetMap query is slow/unavailable.
 */
export type LeicesterSupplierSeed = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  phone?: string;
  kinds: Array<'Plumber' | 'Electrician' | 'Builder' | 'Heating' | 'Locksmith' | 'Carpenter' | 'Roofer'>;
  general: boolean;
};

const all: LeicesterSupplierSeed['kinds'] = ['Plumber','Electrician','Builder','Heating','Locksmith','Carpenter','Roofer'];
const plumbing: LeicesterSupplierSeed['kinds'] = ['Plumber','Heating'];
const building: LeicesterSupplierSeed['kinds'] = ['Builder','Carpenter','Roofer'];

export const LEICESTER_SUPPLIER_SEEDS: LeicesterSupplierSeed[] = [
  { id:'leicester-pts-cobden',name:'PTS Plumbing Trade Supplies',latitude:52.641097,longitude:-1.116755,address:'117 Cobden Street, Leicester LE1 2LB',phone:'0116 242 7700',kinds:plumbing,general:false },
  { id:'leicester-wolseley-freemans',name:'Wolseley Plumb & Parts',latitude:52.618379,longitude:-1.133770,address:'96 Freemens Common Road, Leicester LE2 7SQ',phone:'0116 285 4055',kinds:plumbing,general:false },
  { id:'leicester-city-plumbing',name:'City Plumbing Freemens Common',latitude:52.617311,longitude:-1.134124,address:'75 Commercial Square, Freemens Common Road, Leicester LE2 7SR',phone:'0116 255 5001',kinds:plumbing,general:false },
  { id:'leicester-bestbuy-plumbing',name:'Best Buy Plumbing & Heating',latitude:52.637580,longitude:-1.120195,address:'21–23 Sussex Street, Leicester LE5 3BF',phone:'0116 224 8229',kinds:plumbing,general:false },
  { id:'leicester-kendor',name:'Kendor Leicester',latitude:52.615100,longitude:-1.129000,address:'Knighton Junction Lane, Leicester LE2 6AR',phone:'0116 270 1124',kinds:plumbing,general:false },
  { id:'leicester-baker-soars',name:'Baker & Soars',latitude:52.654678,longitude:-1.143269,address:'33 Parker Drive, Leicester LE4 0JP',phone:'0116 232 3222',kinds:plumbing,general:false },

  { id:'leicester-cef',name:'CEF Leicester Central',latitude:52.654678,longitude:-1.143269,address:'55 Parker Drive, Leicester LE4 0JP',phone:'0116 253 1542',kinds:['Electrician'],general:false },
  { id:'leicester-yesss',name:'YESSS Electrical Leicester',latitude:52.689560,longitude:-1.133517,address:'Units 7–8 Interchange Business Park, Meer End, Birstall LE4 3EH',phone:'0116 268 9460',kinds:['Electrician'],general:false },
  { id:'leicester-edmundson',name:'Edmundson Electrical Leicester',latitude:52.615631,longitude:-1.131786,address:'22 Euston Street, Leicester LE2 7ST',phone:'0116 255 7441',kinds:['Electrician'],general:false },

  { id:'leicester-screwfix-craven',name:'Screwfix Craven Street',latitude:52.640872,longitude:-1.139933,address:'Unit 6 Craven Street, Leicester LE1 4BX',kinds:all,general:true },
  { id:'leicester-screwfix-ulverscroft',name:'Screwfix Ulverscroft Road',latitude:52.644391,longitude:-1.114870,address:'Units 2–3 Hathaway Close, Leicester LE4 6BZ',kinds:all,general:true },
  { id:'leicester-screwfix-thurmaston',name:'Screwfix Thurmaston',latitude:52.661896,longitude:-1.081885,address:'30 Wenlock Way, Leicester LE4 9HU',kinds:all,general:true },
  { id:'leicester-screwfix-braunstone',name:'Screwfix Braunstone',latitude:52.633383,longitude:-1.206897,address:'125 Scudamore Road, Leicester LE3 1UQ',kinds:all,general:true },
  { id:'leicester-toolstation-ravensbridge',name:'Toolstation Ravensbridge',latitude:52.646002,longitude:-1.144583,address:'Unit 3, 20 Ravensbridge Drive, Leicester LE4 0BX',kinds:all,general:true },
  { id:'leicester-selco',name:'Selco Leicester',latitude:52.654678,longitude:-1.143269,address:'47 Parker Drive, Leicester LE4 0JP',phone:'0116 234 4900',kinds:all,general:true },

  { id:'leicester-travis-ravensbridge',name:'Travis Perkins Ravensbridge',latitude:52.646002,longitude:-1.144583,address:'Unit 1 Ravensbridge Drive, Leicester LE4 0BX',kinds:building,general:false },
  { id:'leicester-jewson-welford',name:'Jewson Welford Road',latitude:52.624019,longitude:-1.130527,address:'150 Welford Road, Leicester LE2 6BA',phone:'0116 254 1434',kinds:building,general:false },
];
