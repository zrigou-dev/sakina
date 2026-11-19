package expo.modules.sakinaadhan

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** One scheduled adhan. Everything the service needs is inside, so it works with the app process dead. */
data class AdhanAlarm(
  val id: String,
  val atMs: Long,
  val prayer: String,
  val voiceId: String,
  /** Absolute file path of the recording (bundled voices are copied into app storage by the JS side). */
  val path: String,
  val startMs: Long,
  /** 0 = play to the end of the file. */
  val endMs: Long,
  /** Linear gain 0..1 that levels this file (attenuation only). */
  val gain: Double,
  val fadeInMs: Long,
  val fadeOutMs: Long,
  /** Name of a bundled res/raw clip to play if the file is missing or cannot be decoded. */
  val fallbackRaw: String?,
  val title: String,
  val body: String,
  val stopLabel: String,
  val doneTitle: String,
  val doneBody: String,
) {
  fun toJson(): JSONObject = JSONObject().apply {
    put("id", id); put("atMs", atMs); put("prayer", prayer); put("voiceId", voiceId); put("path", path)
    put("startMs", startMs); put("endMs", endMs); put("gain", gain); put("fadeInMs", fadeInMs); put("fadeOutMs", fadeOutMs)
    put("fallbackRaw", fallbackRaw ?: JSONObject.NULL)
    put("title", title); put("body", body); put("stopLabel", stopLabel); put("doneTitle", doneTitle); put("doneBody", doneBody)
  }

  companion object {
    fun fromJson(o: JSONObject): AdhanAlarm = AdhanAlarm(
      id = o.getString("id"),
      atMs = o.getLong("atMs"),
      prayer = o.optString("prayer", ""),
      voiceId = o.optString("voiceId", ""),
      path = o.optString("path", ""),
      startMs = o.optLong("startMs", 0L),
      endMs = o.optLong("endMs", 0L),
      gain = o.optDouble("gain", 1.0).coerceIn(0.0, 1.0),
      fadeInMs = o.optLong("fadeInMs", 200L),
      fadeOutMs = o.optLong("fadeOutMs", 0L),
      fallbackRaw = if (o.isNull("fallbackRaw")) null else o.optString("fallbackRaw").ifEmpty { null },
      title = o.optString("title", ""),
      body = o.optString("body", ""),
      stopLabel = o.optString("stopLabel", "Stop"),
      doneTitle = o.optString("doneTitle", o.optString("title", "")),
      doneBody = o.optString("doneBody", ""),
    )
  }
}

/** Durable storage (SharedPreferences) so alarms survive process death and reboots. */
object AlarmStore {
  private const val PREFS = "sakina_adhan"
  private const val KEY_ALARMS = "alarms"
  private const val KEY_TZ_TITLE = "tz_title"
  private const val KEY_TZ_BODY = "tz_body"
  private const val KEY_ENSURE_AUDIBLE = "ensure_audible"
  private const val KEY_NEEDS_REPLAN = "needs_replan"

  private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @Synchronized
  fun save(ctx: Context, alarms: List<AdhanAlarm>, tzTitle: String?, tzBody: String?, ensureAudible: Boolean) {
    val arr = JSONArray()
    alarms.forEach { arr.put(it.toJson()) }
    prefs(ctx).edit()
      .putString(KEY_ALARMS, arr.toString())
      .putString(KEY_TZ_TITLE, tzTitle)
      .putString(KEY_TZ_BODY, tzBody)
      .putBoolean(KEY_ENSURE_AUDIBLE, ensureAudible)
      .putBoolean(KEY_NEEDS_REPLAN, false)
      .apply()
  }

  @Synchronized
  fun load(ctx: Context): List<AdhanAlarm> {
    val raw = prefs(ctx).getString(KEY_ALARMS, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).mapNotNull { i -> runCatching { AdhanAlarm.fromJson(arr.getJSONObject(i)) }.getOrNull() }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun find(ctx: Context, id: String): AdhanAlarm? = load(ctx).firstOrNull { it.id == id }

  @Synchronized
  fun remove(ctx: Context, id: String) {
    val rest = load(ctx).filter { it.id != id }
    val arr = JSONArray()
    rest.forEach { arr.put(it.toJson()) }
    prefs(ctx).edit().putString(KEY_ALARMS, arr.toString()).apply()
  }

  fun tzNotice(ctx: Context): Pair<String, String>? {
    val p = prefs(ctx)
    val t = p.getString(KEY_TZ_TITLE, null)
    val b = p.getString(KEY_TZ_BODY, null)
    return if (t.isNullOrEmpty() || b.isNullOrEmpty()) null else Pair(t, b)
  }

  fun ensureAudible(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_ENSURE_AUDIBLE, true)
  fun setNeedsReplan(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean(KEY_NEEDS_REPLAN, v).apply()
  fun needsReplan(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_NEEDS_REPLAN, false)
}
