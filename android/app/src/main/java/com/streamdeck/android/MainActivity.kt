package com.streamdeck.android
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
val ComponentActivity.dataStore by preferencesDataStore("deck")
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                    var host by remember { mutableStateOf("192.168.1.10") }
                var buttons by remember { mutableStateOf(defaultButtons) }
                var onboardingDone by remember { mutableStateOf<Boolean?>(null) }
                val scope = rememberCoroutineScope()
                LaunchedEffect(Unit) {
                    dataStore.data.map { p ->
                        p[stringPreferencesKey("host")]?.let { host = it }
                        p[stringPreferencesKey("buttons")]?.let {
                            try { buttons = Json.decodeFromString(it) } catch (_:Exception){}
                        }
                        p[booleanPreferencesKey("onboardingDone")]?.let { onboardingDone = it }
                        if (onboardingDone == null) onboardingDone = false
                    }.collect{}
                }
                fun save() {
                    scope.launch {
                        dataStore.edit { e ->
                            e[stringPreferencesKey("host")] = host
                            e[stringPreferencesKey("buttons")] = Json.encodeToString(buttons)
                        }
                    }
                }
                fun setDone(done: Boolean) {
                    scope.launch { dataStore.edit { e -> e[booleanPreferencesKey("onboardingDone")] = done } }
                    onboardingDone = done
                }
                fun fetchButtons(h: String) {
                    scope.launch(Dispatchers.IO) {
                        try {
                            val c = URL("http://$h:9137/buttons").openConnection() as HttpURLConnection
                            c.connectTimeout = 2500; c.readTimeout = 2500
                            if (c.responseCode == 200) {
                                val t = c.inputStream.bufferedReader().readText()
                                val b: List<Btn> = Json.decodeFromString(t)
                                if (b.size in 1..30) withContext(Dispatchers.Main) { buttons = b; save() }
                            }
                        } catch (_: Exception) {}
                    }
                }
                LaunchedEffect(host) { fetchButtons(host) }
                fun postButtons(b: List<Btn>) {
                    val h = host
                    scope.launch(Dispatchers.IO) {
                        try {
                            val c = URL("http://$h:9137/buttons").openConnection() as HttpURLConnection
                            c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type","application/json")
                            c.connectTimeout = 2500; c.readTimeout = 2500
                            c.outputStream.use { it.write(Json.encodeToString(b).toByteArray()) }
                            c.inputStream.close()
                        } catch (_: Exception) {}
                    }
                }
                when (onboardingDone) {
                    null -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
                    false -> OnboardingScreen(host = host, onHostChange = { host = it; save() }, onContinue = { setDone(true) }, onSkipDemo = { setDone(true) })
                    else -> DeckScreen(host = host, onHostChange = { host = it; save(); fetchButtons(it) }, buttons = buttons, onButtonsChange = { buttons = it; save(); postButtons(it) })
                }
            }
        }
    }
}
