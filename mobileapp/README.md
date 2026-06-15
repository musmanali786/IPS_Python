# IPS Collector (Flutter)

Field data-collection companion for the IPS Research Platform. Records raw
multi-sensor data in the **GetSensorData (LOPSI)** format, stamps ground-truth
positions from maps built in the web Map Builder, and can stream live location
to the backend.

## Features

- **Multi-sensor logging** — Accelerometer, Gyroscope, Magnetometer, Orientation
  (AHRS, derived), Barometer, Light, Proximity, GNSS, WiFi RSSI, BLE, Sound.
  Each sensor is individually toggled and rate-controlled in **Settings**.
- **GetSensorData-compatible files** — same line formats and dual timestamps as
  the reference logs, with a self-documenting header. Files are written to the
  app-scoped folder `Android/data/com.ips.ips_collector/files/logs` (no special
  storage permission; reachable over USB / share / upload).
- **Maps from the web app** — fetches buildings/floors/paths/APs from
  `/api/buildings/{id}/export`, renders the floor image with overlays, and caches
  each map for offline use.
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

In **Settings → Backend**, set the server URL and API key:

- Android emulator → host machine: `http://10.0.2.2:8000`
- Physical device on the same LAN: `http://<your-computer-ip>:8000`
- API key: one of `INGEST_API_KEYS` configured on the backend (default `dev-key`).

## Backend endpoints used

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/buildings/` | list buildings |
| GET  | `/api/buildings/{id}/export` | full master map |
| GET  | `/api/buildings/{bid}/floors/{fid}/image` | floor image |
| POST | `/api/ingest/location` | live position (X-API-Key) |
| POST | `/api/ingest/logfile` | upload a completed log (X-API-Key) |

## Project layout

```
lib/
├── main.dart                 app entry + providers
├── theme.dart
├── utils.dart                filename / duration helpers
├── models/                   map_models, sensor_config, survey_models
├── services/
│   ├── sensor_logger.dart    the logging engine (GetSensorData writer)
│   ├── settings_service.dart sensor toggles/rates + server config
│   ├── api_client.dart       backend client (X-API-Key)
│   ├── map_repository.dart   fetch + offline cache of maps
│   ├── storage_service.dart  log file storage
│   ├── session_runner.dart   permissions + start/stop + live streaming
│   └── permission_service.dart
├── widgets/                  floor_map_view, live_status_card
└── screens/                  home, settings, map_select, survey,
                              crowdsource, files, root_shell
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
