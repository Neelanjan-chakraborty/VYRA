use crate::types::Location;

const EARTH_RADIUS_KM: f64 = 6371.0;

fn to_radians(degrees: f64) -> f64 {
    (degrees * std::f64::consts::PI) / 180.0
}

/// Great-circle distance, written exactly like `distanceKm` in `@vyra/validation`.
/// `libm` (fdlibm-derived, like V8's Math functions) keeps results bit-identical.
pub fn distance_km(a: Location, b: Location) -> f64 {
    let d_lat = to_radians(b.latitude - a.latitude);
    let d_lon = to_radians(b.longitude - a.longitude);
    let s_lat = libm::sin(d_lat / 2.0);
    let s_lon = libm::sin(d_lon / 2.0);
    // Same association as `cos(a) * cos(b) * sin(dLon / 2) ** 2` in JavaScript.
    let h = s_lat * s_lat
        + (libm::cos(to_radians(a.latitude)) * libm::cos(to_radians(b.latitude))) * (s_lon * s_lon);
    2.0 * EARTH_RADIUS_KM * libm::asin(h.sqrt().min(1.0))
}
