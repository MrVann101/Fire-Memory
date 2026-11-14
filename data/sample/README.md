# FIRMS real-data samples

These are real rows selected from the user-provided 2020 Philippines CSV
downloads, received on 2026-11-14. They are small extraction fixtures, not
simulated data; the source CSV headers and values are preserved. No
`_simulated` marker is present.

- [`modis_firms_sample.csv`](./modis_firms_sample.csv): three MODIS records
  from `data/raw/modis/modis_2020_Philippines.csv`.
- [`viirs_noaa20_firms_sample.csv`](./viirs_noaa20_firms_sample.csv): three
  VIIRS NOAA-20 records from
  `data/raw/viirs-noaa20/viirs-jpss1_2020_Philippines.csv`.
- Source page: [NASA FIRMS Archive Download](https://firms.modaps.eosdis.nasa.gov/download/)
- Retrieval date reported by the downloader: 2026-11-14.

The original archive request confirmation and exact product/processing
selection were not included with the files. The source page is therefore
provided as the archive entry point, not as a product-specific request URL;
standard-versus-NRT remains **VERIFY**.

## Field mapping

| Source CSV field | Normalized `Hotspot` field | Mapping |
|---|---|---|
| `latitude` | `latitude` | Parse finite decimal; require -90 through 90 |
| `longitude` | `longitude` | Parse finite decimal; require -180 through 180 |
| `acq_date`, `acq_time` | `acquisitionDatetime` | Combine the date and UTC `HHMM` time into ISO 8601 UTC |
| `satellite` | `satellite` | Preserve source platform (`Aqua`, `Terra`, or `N20`) |
| `instrument` | `instrument` | Preserve source instrument (`MODIS` or `VIIRS`) |
| `confidence` | `confidence` | MODIS digit strings become numbers; VIIRS categorical codes remain strings |
| `brightness` (MODIS), `bright_ti4` (VIIRS) | `brightness` | Parse the source product's primary brightness temperature; null if missing |
| No source column | `sourceProduct` | Null until the archive manifest/product selection is supplied; do not infer standard/NRT from `version` |
| Source row fields | Audit wrapper | Retain the original row separately from the contract-shaped hotspot |

The supported sample timestamps use four-character, zero-padded UTC `HHMM`
values. Other timestamp forms must be verified against source documentation
before acceptance.
