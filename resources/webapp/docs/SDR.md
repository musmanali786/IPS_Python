**Project Title:** Indoor Positioning System (IPS) Research & Experimentation Platform

**Project Overview:**  
Develop a web‑based application that serves as a unified testbed for Indoor Positioning System researchers, particularly in an academic or classroom setting. The platform must allow users to upload floor plans, manage sensor datasets, run multiple positioning algorithms, and compare their performance through rich visualizations and statistical analysis. The backend will be built with Python Flask, leveraging scientific libraries (NumPy, SciPy, Pandas) for the core computations.

---

## Core Functional Requirements

### 1. Platform & Data Management
- **User Authentication:** Secure sign‑up/login so that each user can save their maps, datasets, and experiment configurations.
- **Map Management:**
  - Upload floor plans (PNG, SVG, JPG).
  - Provide a scaling tool: draw a line on the image and input its real‑world length (e.g., 5 meters) to establish pixels‑to‑meters ratio.
  - Allow the user to define the coordinate origin (0,0) on the map.
- **Dataset Workbench:**
  - Upload sensor data (RSSI, IMU, timestamps) in CSV or JSON format.
  - Include basic cleaning tools: handle missing values, filter outliers, and optionally interpolate missing data.

### 2. Experiment Modules
Each module must let the user adjust key parameters and visualize the resulting position on the map.

#### a. Trilateration (RSSI‑based)
- Drag‑and‑drop virtual anchors (Wi‑Fi APs / BLE beacons) onto the map.
- Set path loss model parameters: Path Loss Exponent (n) and reference power (A) at 1 meter.
- Choose solver: Least Squares or weighted least squares.
- Display the estimated position and the circles representing distance estimates.

#### b. Fingerprinting
- **Training Phase:** Assign collected RSSI fingerprints to specific grid coordinates on the map.
- **Testing Phase:** Select a matching algorithm (k‑Nearest Neighbors, weighted kNN, probabilistic).
- Generate a signal strength heatmap overlay on the floor plan.

#### c. Pedestrian Dead Reckoning (PDR)
- Step detection: tune accelerometer peak thresholds.
- Stride length estimation: choose between user height input or Weinberg model.
- Heading estimation: apply Kalman or complementary filter to magnetometer/gyroscope data.
- Include a drift‑correction toggle to manually reset position when needed.

#### d. BLE & FTM (Hardware‑Specific)
- BLE: apply smoothing filters (moving average, Kalman) to RSSI.
- FTM (Wi‑Fi RTT): display round‑trip time data and compare RSSI‑based vs. FTM‑based distance estimates side by side.

#### e. Device‑Free Positioning (DFP)
- Baseline calibration: capture signal states for an empty room.
- Anomaly detection: visualise signal shadowing when a person moves between anchors without carrying a device.
- Basic diffraction modelling to illustrate how human bodies attenuate RF signals.

### 3. Analytics & Visualisation
- **Real‑time Playback:** Animate the estimated trajectory over time based on dataset timestamps.
- **Error Analysis:**
  - Upload ground‑truth coordinates.
  - Generate CDF (Cumulative Distribution Function) plots of Euclidean error.
  - Visualise error bubbles on the map: larger bubbles indicate higher error at that location.
- **Export Centre:** Download experiment results as a PDF report or raw error data as CSV for further analysis.

---

## Technical Stack Suggestions

- **Backend:** Python Flask (RESTful API) with extensions (Flask‑SQLAlchemy, Flask‑Login).
- **Scientific Computing:** NumPy, SciPy, Pandas for all positioning mathematics.
- **Frontend:** React or Vue.js for a responsive, interactive map canvas (e.g., using Leaflet or Fabric.js for drawing and overlays).
- **Database:** PostgreSQL (with PostGIS extension optional, if spatial queries are desired later).
- **File Storage:** Local or cloud storage (AWS S3) for uploaded maps and datasets.

---

## Development & Deliverables

1. **Fully functional web application** meeting the above specifications.
2. **Source code** with clear documentation (README, API docs if applicable).
3. **Deployment instructions** (e.g., using Docker) and a sample dataset for testing.
4. **User manual** (brief) explaining how to use each experiment module.

---

## Additional Considerations

- The UI must be intuitive, allowing students to focus on algorithm tuning rather than struggling with the interface.
- Performance: computations should be handled asynchronously (e.g., background tasks) to keep the UI responsive, especially for large datasets.
- The platform should be extensible: design the experiment modules in a modular way so new algorithms can be added later with minimal effort.

---

**Timeline & Budget:** (To be discussed based on developer’s estimate)  
**Contact:** (Provide your email or platform contact for proposals/questions)