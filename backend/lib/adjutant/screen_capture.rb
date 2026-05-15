require "base64"

module Adjutant
  class ScreenCapture
    CAPTURE_PATH = "/tmp/adjutant/screen.jpg"

    def initialize(config)
      @width = config.capture_width
      @quality = config.capture_quality
      FileUtils.mkdir_p(File.dirname(CAPTURE_PATH))
    end

    def capture
      # macOS native screen capture (silent, no file in recents)
      system("screencapture", "-x", "-t", "jpg", CAPTURE_PATH)

      # Resize with sips (macOS built-in)
      system("sips", "--resampleWidth", @width.to_s, CAPTURE_PATH, "--out", CAPTURE_PATH,
             [:out, :err] => "/dev/null")

      encode_base64
    rescue => e
      Adjutant.logger.error("Screen capture error: #{e.message}")
      nil
    end

    def encode_base64
      return nil unless File.exist?(CAPTURE_PATH)

      Base64.strict_encode64(File.binread(CAPTURE_PATH))
    end
  end
end
