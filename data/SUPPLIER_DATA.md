# Tradarr supplier directory
The nearby supplier list and live lookup use the existing local radius. The bundled regional directory is also visible when panning or zooming out, using the same trade filters and existing viewport clustering. The on-map counter reports individual suppliers in the current viewport, not the nearby list size. The bundled Midlands directory is generated from public OpenStreetMap county extracts distributed by Geofabrik; it is enriched at runtime by the existing Overpass lookup. OpenStreetMap data is not a complete business register and may omit or contain outdated shops. Directory records are not verified stock, opening hours or exact shop-door coordinates; OSM ways and relations use their bounding-box centres.

## Coverage
East Midlands: Derbyshire, Leicestershire, Lincolnshire, Northamptonshire, Nottinghamshire, Rutland.
West Midlands: Herefordshire, Shropshire, Staffordshire, Warwickshire, West Midlands metropolitan county and Worcestershire.

The first successful import publishes the generated dataset. The empty bootstrap file is not coverage. The app continues live nationwide search even if the scheduled directory has not been built. The import retains named mapped merchant objects, including independents, and deduplicates OSM IDs across county boundaries. Runtime trade classification further excludes irrelevant results.

## Refresh
Run `python -m pip install osmium==4.2.0` and `python scripts/import-supplier-directory.py`, then `node scripts/test-supplier-directory.cjs --require-data`. GitHub Actions runs on initial configuration and weekly; failed imports do not overwrite the existing snapshot.

## Data licence and attribution
© OpenStreetMap contributors — https://www.openstreetmap.org/copyright
Source extracts: https://download.geofabrik.de/europe/united-kingdom/england/
The generated `TradeSupplierDirectory.ts` data is available under the Open Data Commons Open Database License 1.0 (ODbL): https://opendatacommons.org/licenses/odbl/1-0/ .
The OSM dataset remains separate from the hand-maintained Leicester directory. The app already displays OSM attribution on the map. Do not treat retailer directory research as permission to copy their proprietary databases.
