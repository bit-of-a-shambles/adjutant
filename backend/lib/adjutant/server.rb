require "async"
require "async/websocket/adapters/rack"
require "json"
require "fileutils"

module Adjutant
  class Server
    def initialize
      @config = Config.new
      @conversation = Conversation.new
      @feed_store = FeedStore.new
      @screen_capture = ScreenCapture.new(@config)
      @voice_input = VoiceInput.new(@config)
      @voice_output = VoiceOutput.new(@config)
      @clients = []

      @context_manager = ContextManager.new(
        conversation: @conversation,
        feed_store: @feed_store,
        screen_capture: @screen_capture
      )
    end

    def start
      host = @config.server_host
      port = @config.server_port

      Adjutant.logger.info("Adjutant server starting on ws://#{host}:#{port}")

      # Start feed manager in background
      start_feed_manager

      # Start WebSocket server
      start_websocket_server(host, port)
    end

    def handle_connection(connection)
      @clients << connection
      Adjutant.logger.info("Client connected (#{@clients.length} total)")
      send_to(connection, type: "state", state: "idle")

      while (message = connection.read)
        data = JSON.parse(message.to_str)
        handle_message(connection, data)
      end
    rescue => e
      Adjutant.logger.error("Connection error: #{e.message}")
    ensure
      @clients.delete(connection)
      Adjutant.logger.info("Client disconnected (#{@clients.length} total)")
    end

    private

    def start_feed_manager
      @feed_manager = FeedManager.new(
        @config,
        store: @feed_store,
        on_new_items: method(:handle_new_feed_items)
      )
      Thread.new { @feed_manager.start }
    end

    def start_websocket_server(host, port)
      server = self

      app = proc do |env|
        if Async::WebSocket::Adapters::Rack.websocket?(env)
          Async::WebSocket::Adapters::Rack.open(env) do |connection|
            server.handle_connection(connection)
          end
        else
          [200, { "Content-Type" => "text/plain" }, ["Adjutant WebSocket Server"]]
        end
      end

      require "falcon/server"
      require "async/http/endpoint"

      Async do
        endpoint = Async::HTTP::Endpoint.parse("http://#{host}:#{port}")
        falcon = Falcon::Server.new(Falcon::Server.middleware(app), endpoint)
        falcon.run
        Adjutant.logger.info("Adjutant online. All systems nominal.")
      end
    end

    def handle_message(connection, data)
      case data["type"]
      when "start_recording"
        handle_start_recording(connection)
      when "stop_recording"
        handle_stop_recording(connection)
      when "capture_screen"
        handle_capture_screen(connection)
      when "text_query"
        handle_text_query(connection, data["text"])
      when "ping"
        send_to(connection, type: "pong")
      else
        Adjutant.logger.warn("Unknown message type: #{data['type']}")
      end
    end

    def handle_start_recording(connection)
      send_to(connection, type: "state", state: "listening")
      @voice_input.start_recording
    end

    def handle_stop_recording(connection)
      send_to(connection, type: "state", state: "processing")

      # SuperWhisper handles recording + transcription; we poll clipboard for result
      transcript = @voice_input.stop_recording_and_transcribe

      send_to(connection, type: "transcript", text: transcript, source: "user")

      # Save to conversation
      @conversation.add_message("user", transcript)

      # Detect if screen context is requested
      include_screen = transcript.downcase.match?(/screen|see|looking at|display|show/)

      # Query Claude
      process_query(connection, transcript, include_screen: include_screen)
    end

    def handle_capture_screen(connection)
      send_to(connection, type: "state", state: "processing")
      process_query(connection, "Analyze what's currently on my screen.", include_screen: true)
    end

    def handle_text_query(connection, text)
      send_to(connection, type: "state", state: "processing")
      send_to(connection, type: "transcript", text: text, source: "user")
      @conversation.add_message("user", text)

      # Route: if it's a task/action command, use Claude Code CLI.
      # Otherwise use the Claude API for conversation.
      if task_request?(text)
        process_task(connection, text)
      else
        include_screen = text.downcase.match?(/screen|see|looking at|display|show/)
        process_query(connection, text, include_screen: include_screen)
      end
    end

    # Detect if the user wants Adjutant to DO something (code, files, git, etc.)
    # vs just chat/ask a question.
    def task_request?(text)
      t = text.downcase
      # Explicit prefix
      return true if t.match?(/\A\s*(do|run|execute|build|create|fix|deploy|commit|push|install|write|edit|refactor|delete|move|rename|search|find|grep|test|debug|update|upgrade|add|remove|open|close|merge|rebase|checkout|pull|fetch|make|setup|configure|scaffold|generate|implement|code)\b/)
      # References to files, code, repos, commands
      return true if t.match?(/\.(rb|js|ts|py|go|rs|json|yml|yaml|toml|css|html|md|sh|sql)\b/)
      return true if t.match?(/\b(file|directory|folder|repo|repository|branch|commit|pr|pull request|package|dependency|test suite|codebase|terminal|shell|script|server|database|api endpoint)\b/)
      false
    end

    def process_task(connection, text)
      send_to(connection, type: "state", state: "processing")

      claude_code = ClaudeCode.new(
        working_dir: @config.working_dir,
        on_chunk: ->(chunk) {
          send_to(connection, type: "stream_chunk", text: chunk)
        },
        on_complete: ->(full_text) {
          @conversation.add_message("assistant", full_text)

          # Speak a brief summary, not the full output
          summary = summarize_for_speech(full_text)
          audio_path = @voice_output.speak(summary)
          if audio_path
            send_to(connection, type: "speak", audio_path: audio_path)
          end

          send_to(connection, type: "transcript", text: full_text, source: "adjutant")
          send_to(connection, type: "state", state: "idle")
        }
      )

      Thread.new { claude_code.run(text) }
    end

    def process_query(connection, transcript, include_screen: false)
      messages = @context_manager.build_messages(transcript, include_screen: include_screen)

      send_to(connection, type: "state", state: "speaking")

      claude = ClaudeClient.new(
        on_chunk: ->(chunk) {
          send_to(connection, type: "stream_chunk", text: chunk)
        },
        on_complete: ->(full_text) {
          @conversation.add_message("assistant", full_text)

          audio_path = @voice_output.speak(full_text)
          if audio_path
            send_to(connection, type: "speak", audio_path: audio_path)
          end

          send_to(connection, type: "transcript", text: full_text, source: "adjutant")
          send_to(connection, type: "state", state: "idle")
        }
      )

      claude.query(messages)
    end

    # For code tasks, the full output can be huge. Extract just a spoken summary.
    def summarize_for_speech(text)
      # Take the last meaningful paragraph (usually the summary)
      lines = text.strip.split("\n").reject(&:empty?)
      return "Task complete, Commander." if lines.empty?

      # If short enough, speak it all
      return text if text.length < 200

      # Otherwise, speak just the last few lines
      tail = lines.last(3).join(" ")
      tail = tail[0..250] if tail.length > 250
      "Task complete. #{tail}"
    end

    def handle_new_feed_items(items)
      broadcast(type: "feed_items", items: items)
    end

    def send_to(connection, **data)
      connection.write(data.to_json)
      connection.flush
    rescue => e
      Adjutant.logger.error("Send error: #{e.message}")
    end

    def broadcast(**data)
      @clients.each { |c| send_to(c, **data) }
    end
  end
end
