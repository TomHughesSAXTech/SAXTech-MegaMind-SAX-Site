// =====================================
// N8N IF NODE - CONDITION FOR TTS GENERATION
// Place this AFTER the Code node and BEFORE ElevenLabs
// This decides whether to generate TTS or skip it
// =====================================

// COPY THIS INTO THE IF NODE CONDITION FIELD:
{{ $json.enableTTS === true && $json.ttsText && $json.ttsText.length > 0 }}

// This condition checks:
// 1. TTS is enabled (audio toggle is ON)
// 2. There is text to convert
// 3. The text is not empty

// TRUE branch -> Goes to ElevenLabs TTS node
// FALSE branch -> Skips TTS and goes directly to response combine