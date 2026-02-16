import base64
import json
import math
import os
import re

import boto3

location = boto3.client("location")
translate = boto3.client("translate")

MAX_LOCATION_LEN = 200
MAX_HOURS_LEN = 20
MAX_START_TIME_LEN = 30
MAX_TRANSLATE_LEN = 5000

DEFAULT_ALLOWED_ORIGINS = ["*"]
DEFAULT_ORIGIN_ADDRESS = "REPLACE_WITH_YOUR_BASE_ADDRESS"
SERENADE_MAX_MILES = 25
SERENADE_FLAT_RATE = 300
MAX_AUTO_QUOTE_MILES = 120


def _allowed_origins():
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    values = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return values or DEFAULT_ALLOWED_ORIGINS


def _pick_origin(event, allowed):
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin")
    if origin and origin in allowed:
        return origin
    return allowed[0] if allowed else "*"


def _response(status_code, payload, origin):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(payload),
    }


def _parse_body(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8", errors="ignore")
    if not body:
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {}


def _safe_str(data, key, max_len):
    value = data.get(key, "")
    if isinstance(value, list):
        value = value[0] if value else ""
    value = str(value).strip()
    if len(value) > max_len:
        value = value[:max_len]
    return value


def _search_place(place_index, text):
    response = location.search_place_index_for_text(
        IndexName=place_index,
        Text=text,
        MaxResults=1,
    )
    results = response.get("Results") or []
    if not results:
        return None
    return results[0]["Place"]["Geometry"]["Point"]


def _normalize_destination_text(text):
    cleaned = re.sub(r"\s+", " ", text.replace(".", " ")).strip()
    if re.search(r",\s*[A-Za-z]{2}\b", cleaned) and "usa" not in cleaned.lower():
        cleaned = f"{cleaned}, USA"
    return cleaned


def _distance_miles(destination_text):
    place_index = os.environ.get("LOCATION_PLACE_INDEX")
    route_calculator = os.environ.get("LOCATION_ROUTE_CALCULATOR")
    origin_address = os.environ.get("QUOTE_ORIGIN_ADDRESS", DEFAULT_ORIGIN_ADDRESS)

    if not place_index or not route_calculator or origin_address == DEFAULT_ORIGIN_ADDRESS:
        return None

    try:
        origin_coords = _search_place(place_index, origin_address)
        destination_coords = _search_place(place_index, destination_text)
        if not origin_coords or not destination_coords:
            normalized = _normalize_destination_text(destination_text)
            destination_coords = _search_place(place_index, normalized) if normalized else None
        if not origin_coords or not destination_coords:
            return None

        route = location.calculate_route(
            CalculatorName=route_calculator,
            DeparturePosition=origin_coords,
            DestinationPosition=destination_coords,
            TravelMode="Car",
        )
        km = route.get("Summary", {}).get("Distance")
        if km is None:
            return None
        return km * 0.621371
    except Exception as exc:
        print("distance lookup failed", str(exc))
        return None


def _parse_hours(raw):
    match = re.search(r"(\d+(?:\.\d+)?)", raw or "")
    if not match:
        return None
    value = float(match.group(1))
    return value if value > 0 else None


def _parse_start_time(raw_time):
    raw = (raw_time or "").strip().lower().replace(".", "").replace(" ", "")
    if not raw:
        return None
    if raw.endswith(("am", "pm")):
        suffix = raw[-2:]
        clock = raw[:-2]
        hours, minutes = (clock.split(":", 1) + ["00"])[:2] if ":" in clock else (clock, "00")
        try:
            hh = int(hours)
            mm = int(minutes)
        except ValueError:
            return None
        if suffix == "pm" and hh != 12:
            hh += 12
        if suffix == "am" and hh == 12:
            hh = 0
        return f"{hh:02d}:{mm:02d}"
    if ":" in raw:
        try:
            hh, mm = raw.split(":", 1)
            return f"{int(hh):02d}:{int(mm):02d}"
        except ValueError:
            return None
    return None


def _hour_in_range(time_str, start_hour, end_hour):
    if not time_str:
        return True
    try:
        hour = int(time_str.split(":")[0])
    except Exception:
        return False
    return start_hour <= hour <= end_hour


def _build_quote(distance_miles, hours_requested, start_time, service_type):
    tiers = [
        {"min": 0, "max": 25, "rate": 350, "min_hours": 1},
        {"min": 26, "max": 50, "rate": 450, "min_hours": 2},
        {"min": 51, "max": 80, "rate": 550, "min_hours": 2},
        {"min": 81, "max": 120, "rate": 650, "min_hours": 3},
    ]

    if distance_miles is None:
        return {
            "routeTo": "contact",
            "message": "Unable to calculate distance for this location. Please contact us for a custom quote.",
        }

    if service_type == "serenade":
        if distance_miles > SERENADE_MAX_MILES:
            return {
                "routeTo": "contact",
                "message": "Serenade pricing applies only within 25 miles. Please contact us for a custom quote.",
            }
        return {
            "routeTo": "quote",
            "distanceMiles": round(distance_miles, 1),
            "rate": SERENADE_FLAT_RATE,
            "estimate": SERENADE_FLAT_RATE,
            "minimumHours": None,
            "hoursBilled": None,
            "message": "Serenade flat rate quote. Availability is confirmed by email.",
        }

    if distance_miles > MAX_AUTO_QUOTE_MILES:
        return {
            "routeTo": "contact",
            "message": "This location is outside the auto-quote range. Please contact us for a custom quote.",
        }

    tier = next((row for row in tiers if row["min"] <= distance_miles <= row["max"]), None)
    if not tier:
        return {
            "routeTo": "contact",
            "message": "No pricing tier matched this distance. Please contact us for a custom quote.",
        }

    parsed_start = _parse_start_time(start_time)
    if start_time and not _hour_in_range(parsed_start, 13, 22):
        return {
            "routeTo": "contact",
            "message": "Events outside 1pm-10pm require a custom quote.",
        }

    hours = max(hours_requested, tier["min_hours"])
    billed_hours = math.ceil(hours)
    estimate = billed_hours * tier["rate"]
    minimum_hours = tier["min_hours"]

    note = []
    if billed_hours > hours_requested:
        note.append("Partial hours are rounded up.")
    if hours_requested < minimum_hours:
        note.append("Your estimate reflects the minimum booking time.")
    note.append("Estimate only. Availability is confirmed by email.")

    return {
        "routeTo": "quote",
        "distanceMiles": round(distance_miles, 1),
        "rate": tier["rate"],
        "minimumHours": minimum_hours,
        "hoursBilled": billed_hours,
        "estimate": estimate,
        "message": " ".join(note),
    }


def _route_path(event):
    raw_path = event.get("rawPath") or event.get("path") or ""
    if raw_path:
        return raw_path
    request_ctx = event.get("requestContext") or {}
    http = request_ctx.get("http") or {}
    return http.get("path") or ""


def _handle_translate(data, origin):
    text = _safe_str(data, "text", MAX_TRANSLATE_LEN)
    target_lang = _safe_str(data, "target_lang", 10) or "en"
    source_lang = _safe_str(data, "source_lang", 10) or "auto"

    if not text:
        return _response(400, {"message": "text is required"}, origin)

    try:
        result = translate.translate_text(
            Text=text,
            SourceLanguageCode=source_lang,
            TargetLanguageCode=target_lang,
        )
        return _response(
            200,
            {
                "text": result.get("TranslatedText", text),
                "source_language": result.get("SourceLanguageCode", source_lang),
            },
            origin,
        )
    except Exception as exc:
        print("translate failed", str(exc))
        return _response(200, {"text": text, "source_language": source_lang}, origin)


def _handle_quote(data, origin):
    location_text = _safe_str(data, "location", MAX_LOCATION_LEN)
    hours_raw = _safe_str(data, "hours", MAX_HOURS_LEN)
    start_time = _safe_str(data, "start_time", MAX_START_TIME_LEN)
    service_type = _safe_str(data, "service_type", 20).lower()

    if not location_text:
        return _response(400, {"message": "location is required"}, origin)

    if service_type == "serenade":
        hours_requested = 1.0
    else:
        hours_requested = _parse_hours(hours_raw)
        if hours_requested is None:
            return _response(400, {"message": "hours is required for standard quotes"}, origin)

    distance = _distance_miles(location_text)
    quote = _build_quote(distance, hours_requested, start_time, service_type)
    return _response(200, quote, origin)


def lambda_handler(event, _context):
    allowed = _allowed_origins()
    origin = _pick_origin(event, allowed)
    method = (event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod") or "").upper()

    if method == "OPTIONS":
        return _response(200, {"ok": True}, origin)
    if method and method != "POST":
        return _response(405, {"message": "Method not allowed"}, origin)

    path = _route_path(event)
    data = _parse_body(event)

    if path.endswith("/translate"):
        return _handle_translate(data, origin)
    if path.endswith("/quote"):
        return _handle_quote(data, origin)

    if "text" in data and "target_lang" in data:
        return _handle_translate(data, origin)
    if "location" in data:
        return _handle_quote(data, origin)

    return _response(404, {"message": "Route not found"}, origin)
