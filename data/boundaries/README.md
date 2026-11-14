# Philippines boundaries

The tracked GeoJSON files are the provider-supplied simplified geometry
downloads for Philippines ADM0 (country) and ADM2 (province-level units).
Coordinates are longitude/latitude in WGS84 (EPSG:4326).

## Provenance and license

Source: [geoBoundaries](https://www.geoboundaries.org/), using its current
`gbOpen` Philippines API metadata checked and downloaded on 2026-11-14.
The source boundary year is 2020. The API reports **CC BY 3.0 IGO** for
these specific boundary sets and identifies the original contributors as
OCHA Philippines, the National Mapping and Resource Information Authority
(NAMRIA), and the Philippine Statistics Authority (PSA). The cited
source-data page is the
[Philippines administrative levels 0 to 3 dataset](https://data.humdata.org/dataset/philippines-administrative-levels-0-to-3).
The product-specific license in the geoBoundaries API is used here rather
than assuming the general license shown on the geoBoundaries home page.

| Level | geoBoundaries ID | Pinned release | Units | Tracked file |
|---|---|---|---:|---|
| ADM0 | `PHL-ADM0-24100683` | `9469f09` | 1 | `geoBoundaries-PHL-ADM0_simplified.geojson` |
| ADM2 | `PHL-ADM2-2640588` | `41af8f1` | 87 | `geoBoundaries-PHL-ADM2_simplified.geojson` |

The downloads are the API's `simplifiedGeometryGeoJSON` files. The provider
does not publish the simplification tolerance in the API metadata; no
additional simplification was applied. Three known interior points
(Bukidnon, Abra, and Davao del Sur) were tested against both the full ADM2
download and the simplified ADM2 file; each retained the same unique
province match.

## Administrative units and IDs

The ADM2 file contains 81 provinces and six non-province units: four NCR
district units (`NCR, ...`) and the cities of Isabela and Cotabato. Since the
locked `RegionLevel` has no city/district level, these six units are kept
with their source names and represented as `region`; they are not mislabeled
as provinces. Source `shapeID` values, prefixed with their ADM level, form
stable region IDs. Duplicate names therefore do not collide.

The geometry vintage is 2020 and is not a current administrative gazetteer.
In particular, it predates the 2022 division of Maguindanao; the source
contains one `Maguindanao` feature and cannot distinguish the later
Maguindanao del Norte and Maguindanao del Sur. Source names are retained
verbatim rather than silently presenting this older boundary as current.
Assignments in changed areas are therefore limited by the source vintage.

`scripts/ingest/load-regions.ts` creates one country record and 87 ADM2
records, calculates WGS84 bounding boxes, and assigns a point only when it
matches exactly one ADM2 geometry. Outside, unmatched, and ambiguous border
points return `null` for reporting rather than being guessed into a
province. The full unsimplified downloads are local-only and excluded from
Git because the ADM2 file is about 444 MB; the simplified source files are
the tracked loader inputs.

For online attribution, geoBoundaries requests a prominent “geoBoundaries”
name linked to [www.geoboundaries.org](https://www.geoboundaries.org/).
Include the original boundary contributors in project data credits as well.

## Rebuild region records

```powershell
node --experimental-strip-types scripts/ingest/load-regions.ts `
  --output data/boundaries/regions.json
```
