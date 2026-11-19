package expo.modules.sakinaadhan

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.app.NotificationManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

private fun AdhanPlaybackState.Snapshot.toMap(): Map<String, Any?> = mapOf(
  "playing" to playing,
  "finished" to finished,
  "id" to id,
  "prayer" to prayer,
  "voiceId" to voiceId,
  "positionMs" to positionMs,
  "durationMs" to durationMs,
)

/**
 * JS bridge for the native adhan engine. All scheduling logic (which prayers, which voice, which instants)
 * lives in TypeScript where it is unit-tested; this module only arms, plays and reports.
 */
class SakinaAdhanModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  private val listener: (AdhanPlaybackState.Snapshot) -> Unit = { snapshot -> sendEvent("onPlaybackState", snapshot.toMap()) }

  override fun definition() = ModuleDefinition {
    Name("SakinaAdhan")

    Events("onPlaybackState")

    OnCreate {
      AdhanPlaybackState.addListener(listener)
    }

    OnDestroy {
      AdhanPlaybackState.removeListener(listener)
    }

    /** Replaces all armed alarms. Payload: { alarms: [...], tz?: {title, body}, ensureAudible?: bool }. Returns the armed count. */
    AsyncFunction("scheduleAlarms") { payload: String ->
      val root = JSONObject(payload)
      val arr = root.getJSONArray("alarms")
      val alarms = (0 until arr.length()).mapNotNull { i -> runCatching { AdhanAlarm.fromJson(arr.getJSONObject(i)) }.getOrNull() }
      val tz = root.optJSONObject("tz")
      AlarmScheduler.replaceAll(
        context,
        alarms,
        tz?.optString("title"),
        tz?.optString("body"),
        root.optBoolean("ensureAudible", true),
      )
    }

    AsyncFunction("cancelAlarms") {
      AlarmScheduler.cancelAll(context)
    }

    /** Starts playback immediately (in-app prayer time, "test adhan now"). Payload: one alarm object. */
    AsyncFunction("playNow") { payload: String ->
      val alarm = AdhanAlarm.fromJson(JSONObject(payload))
      val service = Intent(context, AdhanService::class.java).putExtra(AdhanService.EXTRA_ALARM, alarm.toJson().toString())
      if (Build.VERSION.SDK_INT >= 26) {
        context.startForegroundService(service)
      } else {
        context.startService(service)
      }
      Unit
    }

    AsyncFunction("stopPlayback") {
      context.startService(Intent(context, AdhanService::class.java).setAction(AdhanService.ACTION_STOP))
      Unit
    }

    Function("getPlaybackState") {
      AdhanPlaybackState.current.toMap()
    }

    Function("getStatus") {
      val ctx = context
      val audio = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val notifications = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val power = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      val now = System.currentTimeMillis()
      mapOf(
        "sdk" to Build.VERSION.SDK_INT,
        "manufacturer" to Build.MANUFACTURER,
        "notificationsEnabled" to notifications.areNotificationsEnabled(),
        "ignoringBatteryOptimizations" to power.isIgnoringBatteryOptimizations(ctx.packageName),
        "armedCount" to AlarmStore.load(ctx).count { it.atMs > now },
        "nextAlarmAtMs" to AlarmScheduler.nextAlarmAt(ctx),
        "alarmVolume" to audio.getStreamVolume(AudioManager.STREAM_ALARM),
        "alarmVolumeMax" to audio.getStreamMaxVolume(AudioManager.STREAM_ALARM),
        "needsReplan" to AlarmStore.needsReplan(ctx),
      )
    }

    /** kind: "battery" | "notifications" | "app". Returns false when the screen could not be opened. */
    Function("openSettings") { kind: String ->
      val ctx = context
      val pkg = ctx.packageName
      val intent = when (kind) {
        "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        "notifications" -> Intent("android.settings.APP_NOTIFICATION_SETTINGS").putExtra("android.provider.extra.APP_PACKAGE", pkg)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
      }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        ctx.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
