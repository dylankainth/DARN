# DARN GeoIP Setup

## Quick Start

1. **Sign up for MaxMind GeoLite2 (Free)**
   - Go to https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
   - Create a free account
   - Download **GeoLite2-City** database (MMDB format)

2. **Place the database file**
   - Save `GeoLite2-City.mmdb` in your DARN project root
   - Or set environment variable: `GEOIP_DB_PATH=/path/to/GeoLite2-City.mmdb`

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## How it works

- **During verification**: IPs are automatically geocoded and stored in SQLite
- **On API fetch**: If any IP is missing location data, it's geocoded on-the-fly and updated
- **No rate limits**: All lookups are local and instant
- **Database updates**: MaxMind releases new databases monthly (optional to update)

## Environment Variables

- `GEOIP_DB_PATH`: Path to GeoLite2-City.mmdb (default: `./GeoLite2-City.mmdb`)

## Note

If the GeoIP database is not found, the system will continue working but location data will be `null`.
