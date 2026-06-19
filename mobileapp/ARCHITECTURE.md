# IPS Collector — Software Requirements & Architecture

Field data-collection companion for the **IPS (Indoor Positioning System)
Research Platform**. It records multi-sensor data in the **GetSensorData
(LOPSI)** format, lets a surveyor build/annotate maps on the device, stamps
ground-truth positions, visualizes live sensors, and can stream/upload to the
backend.

- **Platform:** Flutter (Dart 3.10+), Android-first (iOS scaffolded).
- **Package id:** `com.ips.ips_collector`
- **State management:** `provider` (ChangeNotifier services).

---

## 1. Purpose & scope

| | |
| --- | --- |
| **Goal** | Collect labelled indoor-positioning datasets and prepare maps in the field, fully offline, compatible with the web Map Builder + backend experiment modules. |
| **In scope** | On-device map design (local + geographic), map import/export (ZIP), point/path/grid surveys, crowdsource logging, live sensor visualization, log file management, optional live streaming + upload. |
| **Out of scope** | Running positioning experiments (done on backend), real-time positioning estimation, multi-user sync. |

### Glossary

- **POSI** — ground-truth position line in the log.
- **Reference point / path** — surveyor-defined ground-truth locations on a floor.
- **Calibration** — pixels-per-meter + origin that map image pixels ↔ metres.
- **Georeference** — mapping image pixels ↔ lat/lon via two anchors.
- **Capture profile** — global sensor-rate preset.

---

## 2. Functional requirements (feature list)

### FR-1 Dashboard
- FR-1.1 Show stats: number of maps, log files, enabled sensors.
- FR-1.2 Quick actions: New map, Survey, Crowdsource, Log files.
- FR-1.3 Recent activity: latest log files; "recording in progress" banner.

### FR-2 Map Studio (Module 1)
- FR-2.1 List local maps with thumbnail, floor count; edit/delete.
- FR-2.2 Import a map ZIP (`map.json` + `images/floor_<id>.<ext>`).
- FR-2.3 Create a map via a guided wizard; coordinate type chosen up front
  (Local / Geographic) and immutable thereafter.
- FR-2.4 Wizard steps (type-specific):
  `Details → Floor plan → Calibrate|Register → Reference points & paths → Review`.
- FR-2.5 **Local** calibration: tap points A & B on the image + real distance →
  pixels-per-meter; optional metre origin.
- FR-2.6 **Geographic** registration: place two anchors matching image pixels to
  OpenStreetMap locations; scale, origin and the pixel↔lat/lon transform are
  auto-derived. The floor plan is overlaid on the map (adjustable opacity).
- FR-2.7 Draw reference points and paths (auto-discretized to evenly spaced
  ground-truth points).
- FR-2.8 Persist as `map.json` + image into `IPS_Collector/maps/<name>/`.

### FR-3 Data Collection (Module 2)
- FR-3.1 Pick a map → floor → survey option (reference points / each path / grid).
- FR-3.2 Point-by-point & grid modes dwell at each point; continuous walk
  interpolates between tapped waypoints.
- FR-3.3 Write a POSI line per recorded point (metres; lat/lon from GPS, or from
  the geo-registration for geographic maps).
- FR-3.4 Crowdsource mode: raw logging with no map + manual "Mark POSI" at GPS.
- FR-3.5 Prompt **Stop & save / Cancel** when leaving mid-recording.

### FR-4 Live sensors (centre button)
- FR-4.1 Grid selector; sensors that aren't present are **disabled**.
- FR-4.2 **WiFi analyzer**: channel-vs-signal bell-curve chart per band
  (2.4/5/6 GHz selectable) + AP list (SSID, BSSID, channel, frequency, RSSI).
- FR-4.3 Accelerometer/Gyroscope/Magnetometer: 3-axis live line chart.
- FR-4.4 Barometer/Light/Proximity/Sound: live value + sparkline.
- FR-4.5 BLE: beacons by signal strength. 
- FR-4.6 GNSS: live fix + **satellites list** (constellation, SVID, C/N0,
  elevation/azimuth, used-in-fix) via a native GNSS-status channel.
- FR-4.7 Charts show grid, axis values, and current numeric values.

### FR-5 Settings
- FR-5.1 **Capture profile**: Default / Gaming / Fastest / Custom (Custom is
  auto-selected when a sensor rate is edited).
- FR-5.2 Per-sensor enable + rate.
- FR-5.3 Survey: dwell time, grid spacing.
- FR-5.4 Geographic maps: floor-plan overlay opacity.
- FR-5.5 Backend URL + API key (test); live-location toggle; surveyor name.

### FR-6 Files
- FR-6.1 List/preview/share/upload/delete log files.

---

## 3. Non-functional requirements

- **Offline-first:** maps render and surveys run with no network; only
  streaming/upload and OSM tiles need connectivity.
- **Data fidelity:** logs are GetSensorData/LOPSI-compatible with dual
  timestamps and a self-documenting header.
- **Resilience:** missing sensors/permissions degrade gracefully with messages;
  storage access is gated before any file I/O.
- **Performance:** high-rate sensor streams are throttled for UI (~20 fps) and
  for file writes (per-sensor rate limiting).

---

## 4. System architecture

### 4.1 Layers

```
UI (screens/, widgets/)
        │  watches / calls
State & services (services/)  ── ChangeNotifier + plain service classes
        │  reads / writes
Device & platform  ── sensor plugins, file system, native GNSS EventChannel,
                      OSM tiles, backend HTTP
```

### 4.2 Navigation / information architecture

```
RootShell (permission gate)
  └─ _MainShell  ── bottom navigation + centre FAB
       ├─ [0] Dashboard
       ├─ [1] Map Studio ── New-map wizard ── Geo register (inline OSM)
       ├─ [center FAB] Live sensors ── per-sensor scope
       ├─ [2] Data Collection ── map → floor → Survey / Crowdsource
       └─ [3] Settings
     (Files reached from the Dashboard)
```

### 4.3 State / services (provider)

| Service | Type | Responsibility |
| --- | --- | --- |
| `SettingsService` | ChangeNotifier | sensor toggles/rates, capture profile, dwell/grid, overlay opacity, backend, surveyor — persisted in SharedPreferences. |
| `SensorLogger` | ChangeNotifier | the logging engine: subscribes to enabled sensors, writes LOPSI lines + POSI, exposes live status. |
| `LocalMapRepository` | ChangeNotifier | enumerates/loads/deletes maps under `IPS_Collector/maps/`. |
| `StorageService` | plain | public folder + log file management. |
| `MapDesignService` | plain | builds `map.json`, copies images, discretizes paths, derives calibration. |
| `MapImportService` | plain | ZIP import. |
| `PermissionService` | static | runtime + all-files-access permissions. |
| `ApiClient` | plain | backend health / upload / live location (X-API-Key). |
| `GeoTransform` | value | 2-point pixel↔lat/lon similarity transform. |

---

## 5. Data models & formats

### 5.1 `map.json` (MasterMapJSON + mobile extensions)

```jsonc
{
  "building_id": 0,
  "building_name": "Engineering Building",
  "floors": [{
    "id": 1, "building_id": 0, "floor_number": 0, "label": "Ground",
    "filename": "floor_1.png", "width_px": 2000, "height_px": 1400,
    "pixels_per_meter": 37.8,
    "origin_px": { "x": 0, "y": 1400 },
    "geo_anchors": [ { "px": {"x":..,"y":..}, "lat":.., "lon":.. }, { ... } ],
    "paths": [{
      "id":1, "floor_id":1, "name":"Path 1", "color":"#ef4444",
      "waypoints_px":[{"x":..,"y":..}], "spacing_m":1.0,
      "discrete_points_px":[...], "discrete_points_m":[{"x":..,"y":..,"z":0}]
    }],
    "access_points": [],
    "reference_points": [ {"id":1,"name":"RP1","x_px":..,"y_px":..,"x_m":..,"y_m":..} ]
  }]
}
```

`reference_points` is a mobile extension; everything else matches the backend
schema so imported and on-device maps share one survey path.

### 5.2 GetSensorData (LOPSI) log lines

```
ACCE;AppTs;SensorTs;X;Y;Z;Acc          GYRO;…  MAGN;…  AHRS;…;Pitch;Roll;Yaw;…
PRES;AppTs;SensorTs;mbar;Acc           LIGH;…lux  PROX;…  SOUN;AppTs;RMS;Pa;dB
GNSS;AppTs;SensorTs;Lat;Lon;Alt;Bearing;Acc;Speed;SatInView;SatInUse
WIFI;AppTs;SensorTs;SSID;BSSID;RSS     BLUE;AppTs;Name;MAC;RSS
POSI;Ts;Counter;Lat;Lon;FloorID;BuildingID;X(m);Y(m);MapName
```

### 5.3 Storage layout & permissions

```
/storage/emulated/0/IPS_Collector/
  ├── maps/<name>/ map.json + images/floor_<id>.<ext>
  └── logfiles/    *.txt
```

Android 11+ requires **MANAGE_EXTERNAL_STORAGE** (All files access), requested
on first run via the permission gate before any tab loads. Sensor permissions
(location, nearby WiFi, bluetooth scan, microphone) are requested per use.

---

## 6. Coordinate systems & math

- **Image frame:** x right, y down. Metres: `x_m = (px−ox)/ppm`,
  `y_m = (oy−py)/ppm` (y inverted).
- **Local calibration:** `ppm = |B−A|px / distance_m`; origin default = image
  bottom-left unless set.
- **Geographic registration:** two anchors define a complex similarity
  `w = m·z + b` between pixels (`z = x − i·y`) and a local east/north metre
  frame (equirectangular about anchor 0). `ppm = 1/|m|`; `pixelToLatLng` /
  `latLngToPixel` derive everything else. The floor plan is drawn on the map as
  a `RotatedOverlayImage` from the image-corner lat/lons.
- **Path discretization:** evenly-spaced points along the polyline at
  `spacing_m` (ported verbatim from the backend) → `discrete_points_*`.

---

## 7. Platform integration

- **Sensor plugins:** `sensors_plus` (ACCE/GYRO/MAGN/PRES), `geolocator` (GNSS),
  `wifi_scan`, `flutter_blue_plus`, `light`, `proximity_sensor`, `noise_meter`.
- **Native GNSS status:** Kotlin `MainActivity` registers a
  `GnssStatus.Callback` and streams per-satellite data over the
  `ips/gnss_status` `EventChannel` (geolocator does not expose satellites).
- **Maps:** `flutter_map` + OpenStreetMap tiles; `latlong2`.
- **Charts:** `fl_chart` for live line charts; WiFi analyzer is custom-painted.

### Key dependencies

`provider`, `shared_preferences`, `path_provider`, `share_plus`,
`permission_handler`, `dio`, `file_picker`, `archive`, `intl`,
`cached_network_image`, `wakelock_plus`, `flutter_map`, `latlong2`, `fl_chart`,
plus the sensor plugins above.

---

## 8. Build & run

```bash
cd mobileapp
flutter pub get
flutter run                 # physical Android device recommended (real sensors)
flutter build apk --debug
```

Backend (optional): set Server URL + API key in **Settings → Backend**
(`http://10.0.2.2:8000` for emulator; LAN IP for a device; key from
`INGEST_API_KEYS`, default `dev-key`).

---

## 9. Known limitations / future work

- WiFi scanning is Android-only and throttled (~4 scans / 2 min); the analyzer
  refreshes at that cadence.
- Barometer/light/proximity availability varies; light/proximity probing is
  heuristic (assumes present when uncertain).
- The wizard designs a single floor per map (the model supports multiple).
- iOS: WiFi scanning and the Light plugin are unavailable.
- Possible next steps: multi-floor wizard, OSM overlay preview in the Review
  step, map ZIP export from the device, on-device sample-file generator.

---

## 10. Source map

```
lib/
├── main.dart                       providers + MaterialApp
├── theme.dart
├── models/        map_models, design_models, survey_models, sensor_config
├── services/      sensor_logger, settings_service, session_runner, api_client,
│                  storage_service, local_map_repository, map_import_service,
│                  map_design_service, geo_registration, permission_service
├── widgets/       floor_map_view, design_canvas, live_status_card,
│                  recording_exit_guard
└── screens/       root_shell, dashboard,
                   map_studio + map_wizard + geo_register,   (Module 1)
                   collection + survey + crowdsource,          (Module 2)
                   sensor_scope, files, settings
android/app/src/main/kotlin/.../MainActivity.kt   native GNSS EventChannel
```
