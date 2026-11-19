package expo.modules.sakinaadhan

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Alarms do not survive a reboot, so they are re-armed from storage. A time-zone change keeps the same instants
 * but prayer times differ in the new zone: the app re-plans next time it opens, and the user is told so.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_SET -> AlarmScheduler.rearm(context)
      Intent.ACTION_TIMEZONE_CHANGED -> {
        AlarmScheduler.rearm(context)
        AlarmStore.setNeedsReplan(context, true)
        notifyTimeZone(context)
      }
    }
  }

  private fun notifyTimeZone(context: Context) {
    val (title, body) = AlarmStore.tzNotice(context) ?: return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channelId = "sakina_adhan_info"
    if (Build.VERSION.SDK_INT >= 26) {
      nm.createNotificationChannel(NotificationChannel(channelId, "Prayer time updates", NotificationManager.IMPORTANCE_DEFAULT))
    }
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val content = launch?.let { PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, channelId) else Notification.Builder(context)
    val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    builder.setSmallIcon(if (icon != 0) icon else android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(body).setAutoCancel(true)
    if (content != null) builder.setContentIntent(content)
    nm.notify(NOTIF_TZ, builder.build())
  }

  companion object {
    const val NOTIF_TZ = 71002
  }
}
