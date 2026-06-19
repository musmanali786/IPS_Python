# IPS Collector (Flutter)

Field data-collection companion for the IPS Research Platform. Records raw
multi-sensor data in the **GetSensorData (LOPSI)** format, stamps ground-truth
positions from maps built in the web Map Builder, and can stream live location
to the backend.

## App structure

Persistent **bottom navigation** with four destinations and a centered **Live
sensors** button:

- **Dashboard** — stats (maps, log files, enabled sensors), quick actions and
  recent activity (latest log files).
- **Map Studio** — create maps on-device with a guided wizard, edit them, or
  import a ZIP. You pick the coordinate type up front (Local or Geographic) and
  the wizard only shows the controls relevant to it: *Details → Floor plan →
  Calibrate / Register → Reference points & paths → Review*. Geographic
  registration shows the OpenStreetMap + floor plan + two-point picker inline.
- **Data Collection** — pick a map and run point / path / grid surveys with
  ground-truth POSI, or crowdsource raw sensor logs without a map.
- **Settings** — a global **capture profile** (Default / Gaming / Fastest /
  Custom) plus per-sensor toggles and rates, survey, backend and surveyor
  options.
- **Live sensors** (center button) — pick any sensor to visualize in real time:
  WiFi shows a frequency/channel-vs-RSSI chart with a list of every AP (SSID,
  RSSI, BSSID, channel); accelerometer/gyroscope/magnetometer stream a 3-axis
  line chart; barometer/light/proximity/sound show a live value + sparkline;
  BLE lists beacons by signal strength; GNSS shows the current fix.

## Features

- **Multi-sensor logging** — Accelerometer, Gyroscope, Magnetometer, Orientation
  (AHRS, derived), Barometer, Light, Proximity, GNSS, WiFi RSSI, BLE, Sound.
  Each sensor is individually toggled and rate-controlled in **Settings**.
- **Public app folder** — everything lives in a top-level `IPS_Collector/`
  folder (beside `Documents`):

  ```text
  /storage/emulated/0/IPS_Collector/
    ├── maps/        one sub-folder per imported map (map.json + images/)
    └── logfiles/    GetSensorData log files
  ```

  On Android 11+ this needs the "All files access" permission, requested on first
  use.
- **GetSensorData-compatible files** — same line formats and dual timestamps as
  the reference logs, with a self-documenting header. Written to
  `IPS_Collector/logfiles/`.
- **Map import from ZIP** — import a map ZIP exported by the web Map Builder
  (`map.json` + `images/floor_<id>.<ext>`). Each map is extracted into
  `IPS_Collector/maps/<map name>/` and rendered fully offline (no network).
- **On-device Map Designer** — create and edit maps directly on the phone
  (**Maps → Create map**). Pick a floor-plan image, then drop **reference
  points** and draw **paths** (path-type reference points, auto-discretized
  into evenly-spaced ground-truth points). Two coordinate modes:
  - **Local** — calibrate scale by tapping two points on the image and entering
    the real distance between them; optionally set the metre origin.
  - **Geographic** — register the floor plan onto OpenStreetMap by matching two
    image pixels to two map locations. Scale (pixels-per-meter), origin and the
    pixel↔lat/lon transform are auto-derived from those two anchors, so surveys
    work identically and POSI lines carry true lat/lon.

  Designed maps are written in the same `map.json` + `images/floor_<id>.<ext>`
  layout as imported ones, so the survey flow is shared.
- **Survey modes** — point-by-point (dwell at each reference point), continuous
  walk (tap each waypoint, interpolate between), and auto-generated grid.
- **POSI ground truth** — each recorded point writes an extended-but-compatible
  POSI line:
  `POSI;Timestamp;Counter;Lat;Lon;FloorID;BuildingID;X(m);Y(m);MapName`
- **Crowdsource mode** — raw logging with no map (GNSS/WiFi/IMU), with a manual
  "Mark POSI" button at the current GPS fix.
- **Live location streaming** — posts position to `/api/ingest/location` with an
  `X-API-Key` (toggle in Settings).
- **File manager** — list, preview, share, upload, delete logs.
- Screen-wakelock during surveys.

## Setup

```bash
cd mobileapp
flutter pub get
flutter run        # on a connected Android device (sensors need real hardware)
```

**Importing a map:** in the web Map Builder click *Export Map ZIP (for mobile)*,
copy the `.zip` onto the device, then in the app open **Maps → Import ZIP**.

**Live streaming / upload (optional):** in **Settings → Backend** set the server
URL and API key:

- Android emulator → host machine: `http://10.0.2.2:8000`
- Physical device on the same LAN: `http://<your-computer-ip>:8000`
- API key: one of `INGEST_API_KEYS` configured on the backend (default `dev-key`).

## Backend endpoints

Maps are imported as ZIP files, so the app does **not** fetch maps over the
network. The backend is only used for optional live streaming / upload:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/buildings/{id}/export.zip` | map ZIP (downloaded in the browser, then side-loaded) |
| POST | `/api/ingest/location` | live position (X-API-Key) |
| POST | `/api/ingest/logfile` | upload a completed log (X-API-Key) |

## Project layout

```text
lib/
├── main.dart                 app entry + providers
├── theme.dart
├── utils.dart                filename / duration helpers
├── models/                   map_models, design_models, sensor_config,
│                             survey_models
├── services/
│   ├── sensor_logger.dart    the logging engine (GetSensorData writer)
│   ├── settings_service.dart sensor toggles/rates + server config
│   ├── api_client.dart       backend client (X-API-Key)
│   ├── map_repository.dart   fetch + offline cache of maps
│   ├── local_map_repository.dart  local maps under IPS_Collector/maps/
│   ├── map_import_service.dart    ZIP import
│   ├── map_design_service.dart    designer save (map.json + image + discretize)
│   ├── geo_registration.dart      2-point pixel↔lat/lon similarity transform
│   ├── storage_service.dart  public folder + log file storage
│   ├── session_runner.dart   permissions + start/stop + live streaming
│   └── permission_service.dart
├── widgets/                  floor_map_view, design_canvas, live_status_card
└── screens/                  root_shell, home_launcher,
                              map_studio + map_wizard + geo_register   (Module 1)
                              collection + survey + crowdsource         (Module 2)
                              files, settings
```

## Platform notes / known constraints

- **WiFi scan throttling:** Android 9+ limits foreground scans to ~4 per
  2 minutes. The WiFi rate in Settings is therefore a *request*; point-by-point
  dwell works around it, high-rate continuous WiFi does not.
- **Sensor availability varies:** barometer / light / proximity are absent on
  some devices; the engine degrades gracefully and reports the issue.
- **iOS:** scaffolded but not the primary target — WiFi scanning and the Light
  plugin are Android-only.
- Real sensors require a physical device; an emulator only provides a subset.
