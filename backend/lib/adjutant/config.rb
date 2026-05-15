module Adjutant
  class Config
    attr_reader :data

    def initialize
      @data = Adjutant.config
    end

    def server_host
      data.dig("server", "host") || "127.0.0.1"
    end

    def server_port
      data.dig("server", "port") || 9247
    end

    def tts_voice
      data.dig("voice", "tts_voice") || "Zarvox"
    end

    def tts_rate
      data.dig("voice", "tts_rate") || 200
    end

    def superwhisper_mode_key
      data.dig("voice", "superwhisper_mode_key")
    end

    def capture_width
      data.dig("capture", "width") || 960
    end

    def capture_quality
      data.dig("capture", "quality") || 60
    end

    def persona_name
      data.dig("persona", "name") || "Adjutant"
    end

    def persona_address
      data.dig("persona", "address") || "Commander"
    end

    def working_dir
      dir = data.dig("claude_code", "working_dir") || "~"
      File.expand_path(dir)
    end

    def feeds
      data["feeds"] || []
    end
  end
end
