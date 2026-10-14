package com.streamdeck.android
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI
import kotlinx.serialization.json.*
class WsClient {
    private var ws: WebSocketClient? = null
    private val _state = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _state
    private val _last = MutableStateFlow<String>("")
    val last: StateFlow<String> = _last
    private val _obsConnected = MutableStateFlow(false)
    val obsConnected: StateFlow<Boolean> = _obsConnected
    private val _soundPlaying = MutableStateFlow(false)
    val soundPlaying: StateFlow<Boolean> = _soundPlaying
    private val _soundFile = MutableStateFlow<String?>(null)
    val soundFile: StateFlow<String?> = _soundFile
    var onMessage: ((JsonObject)->Unit)? = null
    var onDeckButtons: ((String)->Unit)? = null
    fun connect(host: String, port: Int = 9137) {
        ws?.close()
        val uri = URI("ws://$host:$port")
        ws = object : WebSocketClient(uri) {
            override fun onOpen(h: ServerHandshake?) { _state.value = true }
            override fun onClose(c: Int, r: String?, b: Boolean) { _state.value = false }
            override fun onError(e: Exception?) { _last.value = e?.message ?: "error" }
            override fun onMessage(m: String?) {
                m?.let {
                    _last.value = it
                    try {
                        val j = Json.parseToJsonElement(it).jsonObject
                        val t = j["type"]?.jsonPrimitive?.content
                        if (t == "obs.state") {
                            _obsConnected.value = j["payload"]?.jsonObject?.get("connected")?.jsonPrimitive?.boolean == true
                        }
                        if (t == "sound.state") {
                            _soundPlaying.value = j["payload"]?.jsonObject?.get("playing")?.jsonPrimitive?.boolean == true
                            _soundFile.value = j["payload"]?.jsonObject?.get("file")?.jsonPrimitive?.contentOrNull
                        }
                        if (t == "deck.buttons") onDeckButtons?.invoke(it)
                        onMessage?.invoke(j)
                    } catch (_: Exception) {}
                }
            }
        }
        ws?.connect()
    }
    fun send(action: String, payload: Map<String,String> = emptyMap()) {
        val p = buildJsonObject { payload.forEach { (k,v) -> put(k, v) } }
        val msg = buildJsonObject { put("action", action); put("payload", p) }
        ws?.send(msg.toString())
    }
    fun close() { ws?.close(); ws = null }
}
