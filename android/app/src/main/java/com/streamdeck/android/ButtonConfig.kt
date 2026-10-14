package com.streamdeck.android
import kotlinx.serialization.Serializable
const val GITHUB_URL = "https://github.com/caspianx/StreamDeck-Companion-Windows/releases"
@Serializable data class Btn(
    val id: Int,
    val label: String,
    val colorHex: Long = 0xFF2962FF,
    val icon: String = "grid",
    val action: String = "obs.setScene",
    val payload: Map<String,String> = emptyMap()
)
val defaultButtons = listOf(
    Btn(0,"SCENE\nMAIN",0xFF1A1C2E,"person","obs.setScene",mapOf("scene" to "SCENE MAIN")),
    Btn(1,"SCENE\nEND",0xFFE53935,"window","obs.setScene",mapOf("scene" to "SCENE END")),
    Btn(2,"SCENE\nSEDIH",0xFFE53935,"window","obs.setScene",mapOf("scene" to "SCENE SEDIH")),
    Btn(3,"MUTE\nMIC",0xFFE53935,"mic_off","obs.toggleMute",mapOf("input" to "Mic/Aux")),
    Btn(4,"Webcam",0xFFE53935,"cam_off","obs.toggleSource",mapOf("scene" to "SCENE MAIN","source" to "Webcam")),
    Btn(5,"SCENE\nKESEL",0xFFE53935,"window","obs.setScene",mapOf("scene" to "SCENE KESEL")),
    Btn(6,"JJ\nSHIKAD",0xFF1DE9B6,"window","sound.play",mapOf("file" to "jj_shikad.mp3")),
    Btn(7,"DUIT",0xFF1DE9B6,"window","sound.play",mapOf("file" to "duit.mp3")),
    Btn(8,"CEPEK",0xFF1DE9B6,"window","sound.play",mapOf("file" to "cepek.mp3")),
    Btn(9,"LOVE\nORANGE",0xFF1DE9B6,"window","sound.play",mapOf("file" to "love_orange.mp3")),
    Btn(10,"DUAR",0xFF1DE9B6,"window","sound.play",mapOf("file" to "duar.mp3")),
    Btn(11,"KETAWA",0xFF2962FF,"play","sound.play",mapOf("file" to "ketawa.mp3")),
    Btn(12,"tegang",0xFF2962FF,"play","sound.play",mapOf("file" to "tegang.mp3")),
    Btn(13,"chuaks",0xFF2962FF,"play","sound.play",mapOf("file" to "chuaks.mp3")),
    Btn(14,"akh",0xFF2962FF,"play","sound.play",mapOf("file" to "akh.mp3")),
)
