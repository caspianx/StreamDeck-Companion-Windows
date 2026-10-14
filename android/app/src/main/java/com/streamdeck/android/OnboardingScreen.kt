package com.streamdeck.android

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun OnboardingScreen(
    host: String,
    onHostChange: (String) -> Unit,
    onContinue: () -> Unit,
    onSkipDemo: () -> Unit
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var testing by remember { mutableStateOf(false) }
    var testOk by remember { mutableStateOf<Boolean?>(null) }
    var testMsg by remember { mutableStateOf("") }

    fun openGithub() {
        try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(GITHUB_URL)).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }) } catch (_: Exception) {}
    }
    fun copyLink() {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("github", GITHUB_URL))
        testMsg = "Link disalin"
    }
    fun test() {
        scope.launch(Dispatchers.IO) {
            withContext(Dispatchers.Main) { testing = true; testMsg = "Tes $host:9137..." }
            try {
                val c = URL("http://$host:9137/status").openConnection() as HttpURLConnection
                c.connectTimeout = 3000; c.readTimeout = 3000
                val ok = c.responseCode == 200
                val txt = if (ok) c.inputStream.bufferedReader().readText() else ""
                withContext(Dispatchers.Main) { testOk = ok; testMsg = if (ok) "Terhubung $txt" else "Gagal ${c.responseCode}" }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { testOk = false; testMsg = "Gagal: ${e.message}" }
            }
            withContext(Dispatchers.Main) { testing = false }
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("StreamDeck — Setup Awal", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("Supaya suara bunyi di speaker PC, download Companion Windows dulu (tanpa coding, klik jalan).", fontSize = 13.sp)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Langkah 1 — Download Companion ZIP", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text("Buka GitHub Releases, download StreamDeck-Companion-Windows.zip", fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { openGithub() }) { Text("Buka GitHub", fontSize = 12.sp) }
                    OutlinedButton(onClick = { copyLink() }) { Text("Copy link", fontSize = 12.sp) }
                }
                Text(GITHUB_URL, fontSize = 10.sp, color = MaterialTheme.colorScheme.primary)
            }
        }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Langkah 2 — Jalankan di PC", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text("Extract ZIP → double-klik start-companion.bat → biarkan jalan. OBS: Tools → WebSocket → Enable 4455 pass admin123 (atau edit pc-companion/config.json).", fontSize = 12.sp)
            }
        }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Langkah 3 — Hubungkan HP", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                OutlinedTextField(value = host, onValueChange = onHostChange, label = { Text("Companion IP 192.168.x.x") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = { test() }, enabled = !testing) { Text(if (testing) "..." else "Test", fontSize = 12.sp) }
                    if (testOk != null) Text(testMsg, fontSize = 11.sp, color = if (testOk == true) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                    else if (testMsg.isNotEmpty()) Text(testMsg, fontSize = 11.sp)
                }
                if (testOk == true) Text("Dot akan hijau OBS terhubung di layar deck.", fontSize = 11.sp)
            }
        }
        Spacer(Modifier.weight(1f))
        Button(onClick = onContinue, modifier = Modifier.fillMaxWidth()) { Text("Lanjut ke Deck") }
        OutlinedButton(onClick = onSkipDemo, modifier = Modifier.fillMaxWidth()) { Text("Lanjut Demo (tanpa PC) — suara di HP") }
        Text("Soft gate: bisa Demo dulu, companion bisa di-download belakangan.", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
