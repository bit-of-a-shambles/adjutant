require "anthropic"

module Adjutant
  class ClaudeClient
    MODEL = "claude-sonnet-4-20250514"

    def initialize(on_chunk:, on_complete:)
      @client = Anthropic::Client.new
      @on_chunk = on_chunk
      @on_complete = on_complete
    end

    def query(messages, system: Prompts::SYSTEM)
      full_response = ""

      stream = @client.messages.stream(
        model: MODEL,
        max_tokens: 1024,
        system_: system,
        messages: messages
      )

      stream.text.each do |text_chunk|
        full_response << text_chunk
        @on_chunk.call(text_chunk)
      end

      @on_complete.call(full_response)
      full_response
    rescue Anthropic::Errors::APIError => e
      error_msg = "Claude API error: #{e.message}"
      Adjutant.logger.error(error_msg)
      @on_complete.call(error_msg)
      error_msg
    rescue => e
      error_msg = "Error: #{e.class} - #{e.message}"
      Adjutant.logger.error(error_msg)
      @on_complete.call(error_msg)
      error_msg
    end
  end
end
