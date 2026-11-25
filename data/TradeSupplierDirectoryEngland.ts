// Keep region snapshots separate so a failed download cannot erase another region.
// Deduplicate mapped objects shared by neighbouring Geofabrik extracts.
import {directoryElements as midlands} from './TradeSupplierDirectory';
import {directoryElements as north} from './TradeSupplierDirectoryNorth';
import {directoryElements as eastSouth} from './TradeSupplierDirectoryEastSouth';
import {directoryElements as outer} from './TradeSupplierDirectoryOuter';
import type {DirectoryElement} from './TradeSupplierDirectory';
export const directoryElements:DirectoryElement[]=[];
const seen=new Set<string>();
for(const batch of [midlands,north,eastSouth,outer]){
 for(const item of batch){
  const id=item.type+'/'+item.id;
  if(!seen.has(id)){seen.add(id);directoryElements.push(item);}
 }
}
