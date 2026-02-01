"""GeoIP geocoding using MaxMind GeoLite2 database."""

from __future__ import annotations

import os
from typing import Dict, Optional

try:
    import geoip2.database
    import geoip2.errors
    GEOIP_AVAILABLE = True
except ImportError:
    GEOIP_AVAILABLE = False


DEFAULT_GEOIP_DB = "GeoLite2-City.mmdb"
GEOIP_DB_ENV = "GEOIP_DB_PATH"


def _get_db_path() -> Optional[str]:
    """Get the GeoIP database path from environment or default."""
    path = os.getenv(GEOIP_DB_ENV, DEFAULT_GEOIP_DB)
    if os.path.exists(path):
        return path
    return None


def geolocate_ip(ip: str) -> Optional[Dict[str, object]]:
    """
    Geolocate an IP address using local GeoIP database.
    Returns dict with lat, lon, city, region, country or None.
    """
    if not GEOIP_AVAILABLE:
        return None
    
    db_path = _get_db_path()
    if not db_path:
        return None
    
    try:
        with geoip2.database.Reader(db_path) as reader:
            response = reader.city(ip)
            
            lat = response.location.latitude
            lon = response.location.longitude
            
            if lat is None or lon is None:
                return None
            
            return {
                "lat": lat,
                "lon": lon,
                "city": response.city.name,
                "region": response.subdivisions.most_specific.name if response.subdivisions else None,
                "country": response.country.name,
            }
    except (geoip2.errors.AddressNotFoundError, ValueError, FileNotFoundError):
        return None
    except Exception:
        return None
