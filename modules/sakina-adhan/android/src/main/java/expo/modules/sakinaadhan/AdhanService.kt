package expo.modules.sakinaadhan

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import java.io.File
import java.io.FileInputStream
import java.util.concurrent.CopyOnWriteArrayList

/** Snapshot of what the service is doing, observable from the JS module while the app is open. */
object AdhanPlaybackState {
  data class Snapshot(
    val playing: Boolean,
    val finished: Boolean,
    val id: String?,
    val prayer: String?,
    val voiceId: String?,
    val positionMs: Long,
    val durationMs: Long,
  )

  @Volatile
  var current: Snapshot = Snapshot(false, false, null, null, null, 0L, 0L)
    private set

  private val listeners = CopyOnWriteArrayList<(Snapshot) -> Unit>()

  fun update(s: Snapshot) {
    current = s
    listeners.forEach { it(s) }
  }

  fun addListener(l: (Snapshot) -> Unit) = listeners.add(l)
  fun removeListener(l: (Snapshot) -> Unit) = listeners.remove(l)
}

/**
 * Plays the adhan as a foreground service on the ALARM audio stream:
 *  - starts from the alarm receiver even when the app process was dead (alarm-clock alarms are exempt from
 *    background-start restrictions) and holds a partial wake lock while playing;
 *  - shows an ongoing notification with a Stop action;
 *  - requests transient exclusive audio focus: other audio pauses; a phone call or another alarm ends the adhan
 *    (an adhan that resumes minutes late is worse than none);
 *  - applies the catalogue's levelling gain, a fade-in and a fade-out, and honours trim points;
 *  - raises a silent alarm volume to a safe minimum (and restores it) so the adhan is never inaudible by accident;
 *  - falls back to a bundled 30 s clip if the file is missing or undecodable.
 */
class AdhanService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var alarm: AdhanAlarm? = null
  private var focusRequest: AudioFocusRequest? = null
  private var ducked = false
  private var previousAlarmVolume = -1
  private var startedAt = 0L
  private var lastEmit = 0L
  private var finished = false

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
        finish(natural = false)
      }
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
        ducked = true
      }
      AudioManager.AUDIOFOCUS_GAIN -> {
        ducked = false
      }
      else -> Unit
    }
  }

  private val ticker = object : Runnable {
    override fun run() {
      val p = player ?: return
      val a = alarm ?: return
      try {
        val pos = p.currentPosition.toLong()
        val duration = p.duration.toLong().coerceAtLeast(1L)
        val end = if (a.endMs > 0) minOf(a.endMs, duration) else duration
        val remaining = end - pos
        if (remaining <= 0L) {
          finish(natural = true)
          return
        }
        var level = a.gain
        val sincePlay = (pos - a.startMs).coerceAtLeast(0L)
        if (a.fadeInMs > 0 && sincePlay < a.fadeInMs) level *= sincePlay.toDouble() / a.fadeInMs
        if (a.fadeOutMs > 0 && remaining < a.fadeOutMs) level *= remaining.toDouble() / a.fadeOutMs
        if (ducked) level *= 0.25
        val v = level.coerceIn(0.0, 1.0).toFloat()
        p.setVolume(v, v)
        val now = System.currentTimeMillis()
        if (now - lastEmit >= 500L) {
          lastEmit = now
          emit(playing = true, position = pos, duration = end)
        }
        handler.postDelayed(this, 100L)
      } catch (e: IllegalStateException) {
        finish(natural = false)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      finish(natural = false)
      return START_NOT_STICKY
    }
    val parsed = intent?.getStringExtra(EXTRA_ALARM)?.let { runCatching { AdhanAlarm.fromJson(org.json.JSONObject(it)) }.getOrNull() }
    if (parsed == null) {
      // startForegroundService() obliges us to call startForeground() quickly, even when there is nothing to play.
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      channel(nm, CHANNEL_PLAYING, "Adhan playback", NotificationManager.IMPORTANCE_LOW)
      val placeholder = builder(CHANNEL_PLAYING).setSmallIcon(smallIcon(android.R.drawable.ic_media_play)).setContentTitle("Adhan").build()
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_PLAYING, placeholder, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      else startForeground(NOTIF_PLAYING, placeholder)
      @Suppress("DEPRECATION")
      stopForeground(true)
      stopSelf()
      return START_NOT_STICKY
    }
    // A new adhan replaces one that is still playing.
    releasePlayer()
    alarm = parsed
    finished = false
    usedFallback = false
    // Must call startForeground quickly after startForegroundService().
    enterForeground(parsed)
    play(parsed)
    return START_NOT_STICKY
  }

  private fun enterForeground(a: AdhanAlarm) {
    val n = playingNotification(a)
    if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_PLAYING, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    else startForeground(NOTIF_PLAYING, n)
  }

  private fun channel(nm: NotificationManager, id: String, name: String, importance: Int) {
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(id) == null) {
      val c = NotificationChannel(id, name, importance)
      c.setSound(null, null)
      c.enableVibration(false)
      nm.createNotificationChannel(c)
    }
  }

  /** The app's status-bar icon (generated from assets/notification-icon.png by expo-notifications); a system icon only as a last resort. */
  private fun smallIcon(fallback: Int): Int {
    val id = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (id != 0) id else fallback
  }

  private fun builder(channelId: String): Notification.Builder =
    if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channelId) else Notification.Builder(this)

  private fun contentIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun playingNotification(a: AdhanAlarm): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    channel(nm, CHANNEL_PLAYING, "Adhan playback", NotificationManager.IMPORTANCE_LOW)
    val stop = PendingIntent.getService(this, 1, Intent(this, AdhanService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
    val b = builder(CHANNEL_PLAYING)
      .setSmallIcon(smallIcon(android.R.drawable.ic_media_play))
      .setContentTitle(a.title)
      .setContentText(a.body)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_ALARM)
    contentIntent()?.let { b.setContentIntent(it) }
    if (Build.VERSION.SDK_INT >= 23) {
      b.addAction(Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_media_pause), a.stopLabel, stop).build())
    } else {
      @Suppress("DEPRECATION")
      b.addAction(android.R.drawable.ic_media_pause, a.stopLabel, stop)
    }
    return b.build()
  }

  private fun play(a: AdhanAlarm) {
    emit(playing = true, position = 0L, duration = 0L)
    ensureAudible()
    val mp = MediaPlayer()
    player = mp
    val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()
    try {
      mp.setAudioAttributes(attrs)
      mp.setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
      if (!setSource(mp, a)) {
        finish(natural = false)
        return
      }
      mp.setVolume(0f, 0f)
      mp.setOnPreparedListener { p ->
        requestFocus(attrs)
        if (a.startMs > 0) p.seekTo(a.startMs.toInt())
        p.start()
        startedAt = System.currentTimeMillis()
        handler.post(ticker)
      }
      mp.setOnCompletionListener { finish(natural = true) }
      mp.setOnErrorListener { _, _, _ ->
        // Undecodable file: play the bundled clip instead of staying silent.
        if (!usedFallback && a.fallbackRaw != null) {
          usedFallback = true
          releasePlayer()
          playFallback(a)
        } else {
          finish(natural = false)
        }
        true
      }
      mp.prepareAsync()
    } catch (e: Exception) {
      finish(natural = false)
    }
  }

  private var usedFallback = false

  /** File first; the bundled clip if the file is missing. */
  private fun setSource(mp: MediaPlayer, a: AdhanAlarm): Boolean {
    // The JS side sends file:// URIs (possibly percent-encoded); the player needs a plain path.
    val path = if (a.path.isEmpty()) "" else (android.net.Uri.parse(a.path).path ?: a.path)
    if (path.isNotEmpty()) {
      val f = File(path)
      if (f.exists() && f.length() > 0) {
        return try {
          FileInputStream(f).use { mp.setDataSource(it.fd) }
          true
        } catch (e: Exception) {
          setFallback(mp, a)
        }
      }
    }
    return setFallback(mp, a)
  }

  private fun setFallback(mp: MediaPlayer, a: AdhanAlarm): Boolean {
    val name = a.fallbackRaw ?: return false
    val id = resources.getIdentifier(name, "raw", packageName)
    if (id == 0) return false
    return try {
      resources.openRawResourceFd(id).use { mp.setDataSource(it.fileDescriptor, it.startOffset, it.length) }
      true
    } catch (e: Exception) {
      false
    }
  }

  private fun playFallback(a: AdhanAlarm) {
    // The fallback clip is already levelled and faded and has no trim points.
    alarm = a.copy(path = "", startMs = 0L, endMs = 0L, gain = 1.0, fadeInMs = 0L, fadeOutMs = 0L)
    play(alarm!!)
  }

  private fun requestFocus(attrs: AudioAttributes) {
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= 26) {
      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
        .setAudioAttributes(attrs)
        .setOnAudioFocusChangeListener(focusListener)
        .build()
      focusRequest = req
      am.requestAudioFocus(req)
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(focusListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
    }
  }

  private fun abandonFocus() {
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= 26) {
      focusRequest?.let { am.abandonAudioFocusRequest(it) }
      focusRequest = null
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(focusListener)
    }
  }

  private fun ensureAudible() {
    if (!AlarmStore.ensureAudible(this)) return
    try {
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val cur = am.getStreamVolume(AudioManager.STREAM_ALARM)
      if (cur == 0) {
        previousAlarmVolume = cur
        val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
        am.setStreamVolume(AudioManager.STREAM_ALARM, (max / 2).coerceAtLeast(1), 0)
      }
    } catch (e: SecurityException) {
      // Do Not Disturb policy may forbid changing it; play at whatever the user set.
    }
  }

  private fun restoreVolume() {
    if (previousAlarmVolume < 0) return
    try {
      (getSystemService(Context.AUDIO_SERVICE) as AudioManager).setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0)
    } catch (e: SecurityException) {
      // ignore
    }
    previousAlarmVolume = -1
  }

  private fun releasePlayer() {
    handler.removeCallbacks(ticker)
    player?.let {
      try {
        if (it.isPlaying) it.stop()
      } catch (e: IllegalStateException) {
        // already stopped
      }
      it.release()
    }
    player = null
  }

  private fun emit(playing: Boolean, position: Long, duration: Long, done: Boolean = false) {
    val a = alarm
    AdhanPlaybackState.update(AdhanPlaybackState.Snapshot(playing, done, a?.id, a?.prayer, a?.voiceId, position, duration))
  }

  /** Ends playback (naturally or by the user/system), then leaves a normal "it is time" notification. */
  private fun finish(natural: Boolean) {
    if (finished) return
    finished = true
    val a = alarm
    releasePlayer()
    abandonFocus()
    restoreVolume()
    emit(playing = false, position = 0L, duration = 0L, done = natural)
    @Suppress("DEPRECATION")
    stopForeground(true)
    if (a != null && a.doneTitle.isNotEmpty()) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      channel(nm, CHANNEL_DONE, "Prayer time", NotificationManager.IMPORTANCE_DEFAULT)
      val b = builder(CHANNEL_DONE)
        .setSmallIcon(smallIcon(android.R.drawable.ic_dialog_info))
        .setContentTitle(a.doneTitle)
        .setContentText(a.doneBody)
        .setAutoCancel(true)
        .setCategory(Notification.CATEGORY_REMINDER)
      contentIntent()?.let { b.setContentIntent(it) }
      nm.notify(NOTIF_DONE_BASE + (a.id.hashCode() and 0xFFFF), b.build())
    }
    stopSelf()
  }

  override fun onDestroy() {
    releasePlayer()
    abandonFocus()
    restoreVolume()
    super.onDestroy()
  }

  companion object {
    const val EXTRA_ALARM = "alarm_json"
    const val ACTION_STOP = "expo.modules.sakinaadhan.ACTION_STOP"
    private const val CHANNEL_PLAYING = "sakina_adhan_playing"
    private const val CHANNEL_DONE = "sakina_adhan_done"
    private const val NOTIF_PLAYING = 71001
    private const val NOTIF_DONE_BASE = 72000
  }
}
