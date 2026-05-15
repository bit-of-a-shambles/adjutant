module Adjutant
  class VoiceInput
    # SuperWhisper integration via URL scheme + clipboard capture.
    # SuperWhisper must be installed and running in the menu bar.
    #
    # Flow:
    #   1. Save current clipboard
    #   2. Trigger SuperWhisper recording via URL scheme
    #   3. Wait for transcription to land on clipboard
    #   4. Restore original clipboard

    POLL_INTERVAL = 0.3   # seconds between clipboard checks
    MAX_WAIT     = 30     # max seconds to wait for transcription

    def initialize(config)
      @mode_key = config.superwhisper_mode_key
    end

    def start_recording
      # Save current clipboard so we can restore it later
      @saved_clipboard = `pbpaste 2>/dev/null`.strip

      # Clear clipboard to detect when SuperWhisper writes to it
      IO.popen("pbcopy", "w") { |p| p.write("") }

      # Trigger SuperWhisper recording
      if @mode_key
        system("open", "superwhisper://mode?key=#{@mode_key}&record=true")
      else
        system("open", "superwhisper://record")
      end

      Adjutant.logger.info("SuperWhisper recording triggered")
    end

    def stop_recording_and_transcribe
      # SuperWhisper stops on its own (silence detection) or via toggle.
      # Toggle stop:
      system("open", "superwhisper://record")

      # Poll clipboard for the transcription result
      transcript = poll_clipboard
      restore_clipboard

      if transcript.nil? || transcript.empty?
        Adjutant.logger.warn("No transcription received from SuperWhisper")
        return "(no transcription received)"
      end

      Adjutant.logger.info("Transcribed: #{transcript[0..80]}...")
      transcript
    end

    private

    def poll_clipboard
      elapsed = 0

      while elapsed < MAX_WAIT
        sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        content = `pbpaste 2>/dev/null`.strip
        # SuperWhisper has written a non-empty result to clipboard
        if !content.empty? && content != @saved_clipboard
          return content
        end
      end

      nil
    end

    def restore_clipboard
      return unless @saved_clipboard

      IO.popen("pbcopy", "w") { |p| p.write(@saved_clipboard) }
      @saved_clipboard = nil
    end
  end
end
