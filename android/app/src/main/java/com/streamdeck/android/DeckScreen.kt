package com.streamdeck.android
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
@Composable fun DeckScreen(host: String, onHostChange: (String)->Unit, buttons: List<Btn>, onButtonsChange: (List<Btn>)->Unit) {
    val ws = remember { WsClient() }
    val connected by ws.connected.collectAsState()
    val obsConnected by ws.obsConnected.collectAsState()
    val soundPlaying by ws.soundPlaying.collectAsState()
    val soundFile by ws.soundFile.collectAsState()
    var scenes by remember { mutableStateOf(listOf<String>()) }
    var inputs by remember { mutableStateOf(listOf<String>()) }
    var sounds by remember { mutableStateOf(listOf<String>()) }
    var showSettings by remember { mutableStateOf(false) }
    var editIdx by remember { mutableStateOf<Int?>(null) }
    val pageSize = 15
    val pageCount = maxOf(1, (buttons.size + pageSize - 1) / pageSize)
    val pagerState = rememberPagerState(pageCount = { pageCount })
    val pagerScope = rememberCoroutineScope()
    LaunchedEffect(pageCount) { if (pagerState.currentPage >= pageCount) pagerState.animateScrollToPage(pageCount - 1) }
    LaunchedEffect(buttons.size) {
        val pc = maxOf(1, (buttons.size + pageSize - 1) / pageSize)
        if (pc > 1 && buttons.size % pageSize == 1) pagerState.animateScrollToPage(pc - 1)
    }
    LaunchedEffect(host) { ws.connect(host) }
    ws.onDeckButtons = { raw ->
        try {
            val j = Json.parseToJsonElement(raw).jsonObject
            val arr = j["payload"]?.jsonArray ?: return@onDeckButtons
            val b: List<Btn> = Json.decodeFromJsonElement(arr)
            if (b.size in 1..30 && b != buttons) onButtonsChange(b)
        } catch (_: Exception) {}
    }
    ws.onMessage = { j ->
        when (j["type"]?.jsonPrimitive?.content) {
            "obs.list" -> {
                val p = j["payload"]?.jsonObject
                scenes = p?.get("scenes")?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList()
                inputs = p?.get("inputs")?.jsonArray?.map { it.jsonObject["name"]!!.jsonPrimitive.content } ?: emptyList()
            }
            "sounds.list" -> sounds = j["payload"]?.jsonArray?.map { it.jsonObject["file"]!!.jsonPrimitive.content } ?: emptyList()
        }
    }
    Column(Modifier.fillMaxSize().background(Color(0xFF1A1C2E)).padding(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(10.dp).background(if (obsConnected) Color(0xFF4CAF50) else Color.Red, shape = androidx.compose.foundation.shape.CircleShape))
                Spacer(Modifier.width(6.dp))
                Text(if (obsConnected) "OBS terhubung" else if (connected) "Companion OK - OBS off" else "Tidak terhubung", color = Color.White, fontSize = 12.sp)
            }
            Row {
                Button(onClick = {
                    if (buttons.size < 30) {
                        val nid = (buttons.maxOfOrNull { it.id } ?: -1) + 1
                        onButtonsChange(buttons + Btn(nid, "Baru", 0xFF2962FF, "grid", "obs.setScene", mapOf("scene" to (scenes.firstOrNull() ?: "SCENE MAIN"))))
                    }
                }, enabled = buttons.size < 30, contentPadding = PaddingValues(6.dp)) { Text("+", fontSize = 11.sp) }
                Spacer(Modifier.width(4.dp))
                Button(onClick = { ws.send("obs.list"); ws.send("sounds.list") }, contentPadding = PaddingValues(6.dp)) { Text("Refresh", fontSize = 11.sp) }
                Spacer(Modifier.width(4.dp))
                Button(onClick = { showSettings = true }, contentPadding = PaddingValues(6.dp)) { Text("IP", fontSize = 11.sp) }
            }
        }
        Spacer(Modifier.height(8.dp))
        HorizontalPager(state = pagerState, modifier = Modifier.weight(1f)) { page ->
            val start = page * pageSize
            val end = minOf(start + pageSize, buttons.size)
            LazyVerticalGrid(columns = GridCells.Fixed(3), modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), userScrollEnabled = false) {
                items(end - start) { li ->
                    val i = start + li
                    val b = buttons[i]
                    val locked = soundPlaying && b.action == "sound.play"
                    Box(Modifier.aspectRatio(1f).background(Color(b.colorHex).copy(alpha = if (locked) 0.45f else 1f), shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                        .combinedClickable(onClick = { if (!locked) ws.send(b.action, b.payload) }, onLongClick = { editIdx = i }, enabled = true)
                        .padding(6.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(iconEmoji(b.icon), fontSize = 16.sp, textAlign = TextAlign.Center)
                            Spacer(Modifier.height(2.dp))
                            Text(b.label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, lineHeight = 13.sp)
                        }
                    }
                }
            }
        }
        if (pageCount > 1) {
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                repeat(pageCount) { p ->
                    Box(Modifier.size(8.dp).background(if (p == pagerState.currentPage) Color.White else Color.Gray, shape = CircleShape).clickable { pagerScope.launch { pagerState.animateScrollToPage(p) } })
                    if (p < pageCount - 1) Spacer(Modifier.width(8.dp))
                }
                Spacer(Modifier.width(10.dp))
                Text("${pagerState.currentPage + 1}/$pageCount", color = Color.Gray, fontSize = 10.sp)
            }
        }
        if (soundPlaying) Text("Memutar ${soundFile ?: ""} — tombol sound terkunci", color = Color(0xFFFFAB91), fontSize = 10.sp)
        else if (!connected) Text("Hubungkan HP & PC 1 WiFi. Companion: ws://$host:9137  OBS :4455 — swipe ganti halaman", color = Color(0xFFFFAB91), fontSize = 10.sp)
    }
    if (showSettings) {
        var tmp by remember { mutableStateOf(host) }
        AlertDialog(onDismissRequest = { showSettings = false }, title = { Text("Companion IP") },
            text = { OutlinedTextField(value = tmp, onValueChange = { tmp = it }, label = { Text("192.168.x.x") }) },
            confirmButton = { TextButton(onClick = { onHostChange(tmp); ws.connect(tmp); showSettings = false }) { Text("Simpan") } },
            dismissButton = { TextButton(onClick = { showSettings = false }) { Text("Batal") } })
    }
    editIdx?.let { idx ->
        val b = buttons[idx]
        var label by remember { mutableStateOf(b.label) }
        var colorHex by remember { mutableStateOf(b.colorHex) }
        var icon by remember { mutableStateOf(b.icon) }
        var action by remember { mutableStateOf(b.action) }
        var scene by remember { mutableStateOf(b.payload["scene"] ?: scenes.firstOrNull() ?: "SCENE MAIN") }
        var input by remember { mutableStateOf(b.payload["input"] ?: inputs.firstOrNull() ?: "Mic/Aux") }
        var source by remember { mutableStateOf(b.payload["source"] ?: "Webcam") }
        var file by remember { mutableStateOf(b.payload["file"] ?: sounds.firstOrNull() ?: "") }
        val presets = listOf(0xFF1A1C2EL, 0xFFE53935L, 0xFF1DE9B6L, 0xFF2962FFL, 0xFFFF8F00L, 0xFF6A1B9AL)
        val icons = listOf("grid","window","person","mic_off","cam_off","play","mic","volume","light","star")
        val ctx = LocalContext.current
        val scope = rememberCoroutineScope()
        var upStat by remember { mutableStateOf("") }
        val pickSound = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            scope.launch(Dispatchers.IO) {
                try {
                    val cr = ctx.contentResolver
                    var name = "upload.mp3"
                    cr.query(uri, null, null, null, null)?.use { c ->
                        val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (c.moveToFirst() && idx >= 0) c.getString(idx)?.let { name = it }
                    }
                    if (!Regex("""\.(mp3|wav|ogg|m4a)$""", RegexOption.IGNORE_CASE).containsMatchIn(name)) { withContext(Dispatchers.Main){ upStat = "Butuh mp3/wav/ogg/m4a" }; return@launch }
                    val bytes = cr.openInputStream(uri)?.readBytes() ?: throw Exception("gagal baca")
                    if (bytes.size > 20*1024*1024) { withContext(Dispatchers.Main){ upStat = ">20MB" }; return@launch }
                    val conn = URL("http://$host:9137/upload").openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"; conn.doOutput = true
                    conn.setRequestProperty("x-filename", name)
                    conn.setRequestProperty("Content-Type", "application/octet-stream")
                    conn.connectTimeout = 15000; conn.readTimeout = 15000
                    conn.outputStream.use { it.write(bytes) }
                    val code = conn.responseCode
                    val resp = try { conn.inputStream.bufferedReader().readText() } catch(_:Exception){ conn.errorStream?.bufferedReader()?.readText() ?: "" }
                    if (code !in 200..299) throw Exception(resp)
                    val j = try { Json.parseToJsonElement(resp).jsonObject } catch(_:Exception){ null }
                    val ret = j?.get("file")?.jsonPrimitive?.content ?: name
                    withContext(Dispatchers.Main){ if (!sounds.contains(ret)) sounds = sounds + ret; file = ret; upStat = "OK $ret — bunyi di PC" }
                } catch(e: Exception){ withContext(Dispatchers.Main){ upStat = "Gagal: ${e.message}" } }
            }
        }
        AlertDialog(onDismissRequest = { editIdx = null }, title = { Text("Edit tombol ${idx+1}/${buttons.size}") },
            text = {
                Column {
                    OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("Nama (label)") })
                    Spacer(Modifier.height(6.dp))
                    Text("Warna", fontSize = 11.sp, color = Color.Gray)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        presets.forEach { c -> Box(Modifier.size(28.dp).background(Color(c), shape = androidx.compose.foundation.shape.CircleShape).border(if (c==colorHex) 2.dp else 1.dp, if (c==colorHex) Color.White else Color.Gray, shape = androidx.compose.foundation.shape.CircleShape).clickable { colorHex = c }) }
                    }
                    Spacer(Modifier.height(6.dp))
                    DropdownField("Icon ${iconEmoji(icon)}", icon, icons) { icon = it }
                    Spacer(Modifier.height(6.dp))
                    var exp by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(expanded = exp, onExpandedChange = { exp = !exp }) {
                        OutlinedTextField(value = action, onValueChange = {}, readOnly = true, label = { Text("Fungsi (action)") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = exp) }, modifier = Modifier.menuAnchor())
                        ExposedDropdownMenu(expanded = exp, onDismissRequest = { exp = false }) {
                            listOf("obs.setScene","obs.toggleMute","obs.toggleSource","sound.play").forEach {
                                DropdownMenuItem(text = { Text(it) }, onClick = { action = it; exp = false })
                            }
                        }
                    }
                    when (action) {
                        "obs.setScene" -> DropdownField("Scene", scene, scenes.ifEmpty { listOf(scene) }) { scene = it }
                        "obs.toggleMute" -> DropdownField("Input Mic", input, inputs.ifEmpty { listOf(input) }) { input = it }
                        "obs.toggleSource" -> {
                            DropdownField("Scene", scene, scenes.ifEmpty { listOf(scene) }) { scene = it }
                            DropdownField("Source", source, listOf(source, "Webcam", "Camera")) { source = it }
                        }
                        "sound.play" -> {
                            DropdownField("File suara", file, sounds.ifEmpty { listOf(file) }) { file = it }
                            Spacer(Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(onClick = { pickSound.launch("audio/*") }, contentPadding = PaddingValues(6.dp)) { Text("Pilih file", fontSize = 11.sp) }
                                Text(if (upStat.isEmpty()) "Upload ke PC, bunyi di speaker PC" else upStat, fontSize = 10.sp, color = Color.Gray)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (label.trim().isEmpty()) return@TextButton
                    val payload = when (action) {
                        "obs.setScene" -> mapOf("scene" to scene)
                        "obs.toggleMute" -> mapOf("input" to input)
                        "obs.toggleSource" -> mapOf("scene" to scene, "source" to source)
                        "sound.play" -> mapOf("file" to file)
                        else -> emptyMap()
                    }
                    val nb = buttons.toMutableList(); nb[idx] = b.copy(label = label.trim(), colorHex = colorHex, icon = icon, action = action, payload = payload)
                    onButtonsChange(nb); editIdx = null
                }) { Text("Simpan") }
            }, dismissButton = {
                Row {
                    if (buttons.size > 1) TextButton(onClick = { val nb = buttons.toMutableList(); nb.removeAt(idx); onButtonsChange(nb); editIdx = null }) { Text("Hapus", color = Color.Red) }
                    TextButton(onClick = { editIdx = null }) { Text("Batal") }
                }
            })
    }
}
@Composable fun DropdownField(label: String, value: String, options: List<String>, onPick: (String)->Unit) {
    var exp by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = exp, onExpandedChange = { exp = !exp }) {
        OutlinedTextField(value = value, onValueChange = {}, readOnly = true, label = { Text(label) }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = exp) }, modifier = Modifier.menuAnchor())
        ExposedDropdownMenu(expanded = exp, onDismissRequest = { exp = false }) {
            options.forEach { o -> DropdownMenuItem(text = { Text(o) }, onClick = { onPick(o); exp = false }) }
        }
    }
}
fun iconEmoji(icon: String) = when(icon){
    "grid"->"▦"; "window"->"⬜"; "person"->"👤"; "mic_off"->"🎤✕"; "cam_off"->"📷✕"; "play"->"▶"; "mic"->"🎤"; "volume"->"🔊"; "light"->"💡"; "star"->"★"; else->"▦"
}
