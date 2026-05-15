module Adjutant
  class ContextManager
    def initialize(conversation:, feed_store:, screen_capture:)
      @conversation = conversation
      @feed_store = feed_store
      @screen_capture = screen_capture
    end

    def build_messages(transcript, include_screen: false)
      messages = @conversation.recent_messages

      # Build the current user message
      user_content = []

      # Add feed digest as context if there are recent items
      digest = @feed_store.recent_digest(hours: 6)
      unless digest == "No recent intelligence."
        user_content << {
          type: "text",
          text: "[Intelligence feed digest]\n#{digest}\n\n[End digest]"
        }
      end

      # Add screen capture if requested
      if include_screen
        screenshot_b64 = @screen_capture.capture
        if screenshot_b64
          user_content << {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: screenshot_b64
            }
          }
        end
      end

      # Add the user's spoken text
      user_content << { type: "text", text: transcript }

      # Build final messages array
      messages + [{ role: "user", content: user_content }]
    end
  end
end
