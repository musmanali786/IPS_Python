package com.hayat.ips.ips_collector

import android.content.Context
import android.location.GnssStatus
import android.location.LocationManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel

class MainActivity : FlutterActivity() {
    private val gnssChannel = "ips/gnss_status"
    private var locationManager: LocationManager? = null
    private var gnssCallback: GnssStatus.Callback? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, gnssChannel)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    startGnss(events)
                }

                override fun onCancel(arguments: Any?) {
                    stopGnss()
                }
            })
    }

    private fun startGnss(events: EventChannel.EventSink?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            events?.error("UNSUPPORTED", "GNSS status requires Android 7.0+", null)
            return
        }
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        gnssCallback = object : GnssStatus.Callback() {
            override fun onSatelliteStatusChanged(status: GnssStatus) {
                val sats = ArrayList<HashMap<String, Any>>()
                for (i in 0 until status.satelliteCount) {
                    val m = HashMap<String, Any>()
                    m["svid"] = status.getSvid(i)
                    m["constellation"] = constellationName(status.getConstellationType(i))
                    m["cn0"] = status.getCn0DbHz(i).toDouble()
                    m["azimuth"] = status.getAzimuthDegrees(i).toDouble()
                    m["elevation"] = status.getElevationDegrees(i).toDouble()
                    m["usedInFix"] = status.usedInFix(i)
                    sats.add(m)
                }
                events?.success(sats)
            }
        }
        try {
            locationManager?.registerGnssStatusCallback(gnssCallback!!, null)
        } catch (e: SecurityException) {
            events?.error("PERMISSION", "Location permission required for GNSS status", null)
        }
    }

    private fun stopGnss() {
        gnssCallback?.let { locationManager?.unregisterGnssStatusCallback(it) }
        gnssCallback = null
    }

    private fun constellationName(type: Int): String = when (type) {
        GnssStatus.CONSTELLATION_GPS -> "GPS"
        GnssStatus.CONSTELLATION_GLONASS -> "GLONASS"
        GnssStatus.CONSTELLATION_BEIDOU -> "BeiDou"
        GnssStatus.CONSTELLATION_GALILEO -> "Galileo"
        GnssStatus.CONSTELLATION_QZSS -> "QZSS"
        GnssStatus.CONSTELLATION_SBAS -> "SBAS"
        GnssStatus.CONSTELLATION_IRNSS -> "IRNSS"
        else -> "Other"
    }
}
