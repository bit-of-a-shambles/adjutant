module Adjutant
  class VoiceOutput
    AUDIO_DIR = "/tmp/adjutant"

    # ffmpeg filter chain to simulate a StarCraft Adjutant comm voice:
    # Samantha base voice → pitch down → military radio bandpass →
    # resonance boost → compression → subtle comm echo → normalize
    ADJUTANT_FILTER = [
      # Subtle pitch down ~4% — just a touch of weight, not obviously shifted
      "asetrate=22050*0.96,aresample=44100",
      # Military radio bandpass (300-3400 Hz)
      "highpass=f=300,lowpass=f=3400",
      # Boost 1.8kHz for "through a comm speaker" presence
      "equalizer=f=1800:t=q:w=2:g=5",
      # Cut low-mids to reduce warmth (more synthetic)
      "equalizer=f=800:t=q:w=1:g=-3",
      # Heavy compression — flat, controlled delivery
      "acompressor=threshold=-18dB:ratio=6:attack=3:release=40",
      # Short echo — comm channel / cockpit ambience
      "aecho=0.85:0.6:12:0.25",
      # Normalize loud and punchy
      "loudnorm=I=-14:LRA=8:TP=-1"
    ].join(",")

    def initialize(config)
      @voice = config.tts_voice
      @rate = config.tts_rate
      FileUtils.mkdir_p(AUDIO_DIR)
    end

    def speak(text)
      timestamp = Time.now.to_i
      raw_path = File.join(AUDIO_DIR, "raw_#{timestamp}.aiff")
      output_path = File.join(AUDIO_DIR, "speech_#{timestamp}.wav")

      # Step 1: Generate raw TTS with Samantha (clear female voice)
      system("say", "-v", @voice, "-r", @rate.to_s, "-o", raw_path, text)

      unless File.exist?(raw_path)
        Adjutant.logger.error("TTS generation failed")
        return nil
      end

      # Step 2: Process through ffmpeg to create Adjutant voice
      success = system(
        "ffmpeg", "-y", "-i", raw_path,
        "-af", ADJUTANT_FILTER,
        "-ar", "44100",
        output_path,
        [:out, :err] => "/dev/null"
      )

      # Clean up raw file
      File.delete(raw_path) rescue nil

      if success && File.exist?(output_path)
        # Also play it immediately via afplay (non-blocking)
        spawn("afplay", output_path, [:out, :err] => "/dev/null")
        Adjutant.logger.info("Speaking: #{text[0..60]}...")
        output_path
      else
        Adjutant.logger.error("ffmpeg processing failed, falling back to direct TTS")
        speak_direct(text)
        nil
      end
    rescue => e
      Adjutant.logger.error("TTS error: #{e.message}")
      nil
    end

    def speak_direct(text)
      system("say", "-v", @voice, "-r", @rate.to_s, text)
    end
  end
end
