package expo.modules.sakinaadhan

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Arms prayer-time alarms with AlarmManager.setAlarmClock — the strongest guarantee Android offers:
 * it wakes the device from Doze, is exempt from the exact-alarm permission, and may start a foreground service.
 */
object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.sakinaadhan.ACTION_FIRE"
  const val EXTRA_ID = "alarm_id"

  private fun fireIntent(ctx: Context, id: String): Intent =
    Intent(ctx, AdhanReceiver::class.java).setAction(ACTION_FIRE).setData(Uri.parse("sakina-adhan://alarm/$id")).putExtra(EXTRA_ID, id)

  private fun firePending(ctx: Context, id: String, flags: Int): PendingIntent? =
    PendingIntent.getBroadcast(ctx, 0, fireIntent(ctx, id), flags or PendingIntent.FLAG_IMMUTABLE)

  private fun showIntent(ctx: Context): PendingIntent? {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    return PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun manager(ctx: Context): AlarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun arm(ctx: Context, alarm: AdhanAlarm) {
    val pending = firePending(ctx, alarm.id, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    manager(ctx).setAlarmClock(AlarmManager.AlarmClockInfo(alarm.atMs, showIntent(ctx)), pending)
  }

  fun cancel(ctx: Context, id: String) {
    val pending = firePending(ctx, id, PendingIntent.FLAG_NO_CREATE) ?: return
    manager(ctx).cancel(pending)
    pending.cancel()
  }

  /** Replaces every previously armed alarm with `alarms` (past ones are dropped). Returns how many were armed. */
  fun replaceAll(ctx: Context, alarms: List<AdhanAlarm>, tzTitle: String?, tzBody: String?, ensureAudible: Boolean): Int {
    AlarmStore.load(ctx).forEach { cancel(ctx, it.id) }
    val now = System.currentTimeMillis()
    val future = alarms.filter { it.atMs > now + 1_000L }.sortedBy { it.atMs }
    AlarmStore.save(ctx, future, tzTitle, tzBody, ensureAudible)
    future.forEach { arm(ctx, it) }
    return future.size
  }

  fun cancelAll(ctx: Context) {
    AlarmStore.load(ctx).forEach { cancel(ctx, it.id) }
    AlarmStore.save(ctx, emptyList(), null, null, true)
  }

  /** Re-arms stored alarms (after reboot / app update / clock change). Fired and past alarms are skipped. */
  fun rearm(ctx: Context): Int {
    val now = System.currentTimeMillis()
    val future = AlarmStore.load(ctx).filter { it.atMs > now + 1_000L }
    future.forEach { arm(ctx, it) }
    return future.size
  }

  fun nextAlarmAt(ctx: Context): Long? = AlarmStore.load(ctx).map { it.atMs }.filter { it > System.currentTimeMillis() }.minOrNull()
}
