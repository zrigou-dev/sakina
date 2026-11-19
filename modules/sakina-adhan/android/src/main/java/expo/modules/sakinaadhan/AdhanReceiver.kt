package expo.modules.sakinaadhan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/** Receives the prayer-time alarm and starts the playback service (allowed: alarm-clock alarms are exempt). */
class AdhanReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val alarm = AlarmStore.find(context, id) ?: return
    AlarmStore.remove(context, id)
    val service = Intent(context, AdhanService::class.java).putExtra(AdhanService.EXTRA_ALARM, alarm.toJson().toString())
    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
  }
}
