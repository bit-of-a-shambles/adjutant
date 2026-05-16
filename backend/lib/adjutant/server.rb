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

      # Build URL-to-category mapping for dashboard queries
      @url_to_category = {}
      (@config.data["feeds"] || []).each { |f| @url_to_category[f["url"]] = f["category"] }
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
        raw = message.to_str rescue message.to_s
        Adjutant.logger.info("Received: #{raw[0..100]}")
        data = JSON.parse(raw)
        handle_message(connection, data)
      end
    rescue => e
      Adjutant.logger.error("Connection error: #{e.class}: #{e.message}")
      Adjutant.logger.error(e.backtrace&.first(3)&.join("\n"))
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
      when "stop_speech"
        handle_stop_speech(connection)
      when "dashboard_feeds"
        handle_dashboard_feeds(connection, data)
      when "dashboard_search"
        handle_dashboard_search(connection, data)
      when "dashboard_mark_read"
        handle_dashboard_mark_read(connection, data)
      when "dashboard_mark_all_read"
        handle_dashboard_mark_all_read(connection, data)
      when "dashboard_ask"
        handle_dashboard_ask(connection, data)
      when "ping"
        send_to(connection, type: "pong")
      else
        Adjutant.logger.warn("Unknown message type: #{data['type']}")
      end
    end

    def handle_stop_speech(connection)
      system("killall", "afplay", err: File::NULL, out: File::NULL)
      system("killall", "say", err: File::NULL, out: File::NULL)
      send_to(connection, type: "state", state: "idle")
      Adjutant.logger.info("Speech stopped by user")
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
      # Self-improvement / config change requests
      return true if self_improvement_request?(t)
      false
    end

    # Detect if the user is asking Adjutant to modify itself
    def self_improvement_request?(text)
      t = text.downcase
      t.match?(/\b(adjutant|yourself|your own|your code|your config|your feed|your voice|this app|this project)\b/) ||
        t.match?(/\badd.*(feed|rss|source|ticker)\b/) ||
        t.match?(/\bchange.*(voice|persona|style|theme|color)\b/)
    end

    SELF_IMPROVEMENT_CONTEXT = <<~CONTEXT
      You are modifying the Adjutant project — a desktop overlay AI assistant.
      This is a Ruby backend + Electron frontend app. You have full permission to read and edit any files.

      Key files:
      - backend/config/feeds.yml — RSS feed URLs (add/remove feeds here)
      - backend/config/settings.yml — voice, capture, persona settings
      - backend/lib/adjutant/server.rb — WebSocket server + request routing
      - backend/lib/adjutant/feed_manager.rb — RSS polling logic
      - backend/lib/adjutant/voice_output.rb — TTS + ffmpeg voice filter
      - frontend/src/renderer/app.bundle.js — Three.js face + UI
      - frontend/src/renderer/styles/hud.css — HUD styling

      When adding feeds, edit backend/config/feeds.yml.
      When changing voice/persona, edit backend/config/settings.yml.
      When changing UI/visuals, edit the frontend files.

      The user's request:
    CONTEXT

    def process_task(connection, text)
      send_to(connection, type: "state", state: "processing")

      is_self_improvement = self_improvement_request?(text)

      # Use Adjutant's own project dir for self-improvement tasks
      working_dir = if is_self_improvement
        File.expand_path("../../..", __dir__)
      else
        @config.working_dir
      end

      task_text = if is_self_improvement
        "#{SELF_IMPROVEMENT_CONTEXT}#{text}"
      else
        text
      end

      claude_code = ClaudeCode.new(
        working_dir: working_dir,
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

      Thread.new { claude_code.run(task_text) }
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

    # --- Dashboard handlers ---

    def handle_dashboard_feeds(connection, data)
      category = data["category"]
      limit = data["limit"] || 50
      offset = data["offset"] || 0

      result = @feed_store.by_category(category, @url_to_category, limit: limit, offset: offset)

      # Build unread counts grouped by category
      raw_counts = @feed_store.unread_counts
      unread_by_category = Hash.new(0)
      raw_counts.each do |row|
        cat = @url_to_category[row["feed_url"]] || "other"
        unread_by_category[cat] += row["count"]
      end

      # Add category to each item
      items = result[:items].map do |item|
        item["category"] = @url_to_category[item["feed_url"]] || "other"
        item
      end

      send_to(connection,
        type: "dashboard_feeds_result",
        items: items,
        total: result[:total],
        unread_counts: unread_by_category
      )
    end

    def handle_dashboard_search(connection, data)
      query = data["query"] || ""
      items = @feed_store.search(query).map do |item|
        item["category"] = @url_to_category[item["feed_url"]] || "other"
        item
      end
      send_to(connection, type: "dashboard_search_result", items: items)
    end

    def handle_dashboard_mark_read(connection, data)
      @feed_store.mark_read(data["id"])
      send_to(connection, type: "dashboard_updated")
    end

    def handle_dashboard_mark_all_read(connection, data)
      category = data["category"]
      if category && category != "all"
        urls = @url_to_category.select { |_u, c| c == category }.keys
        @feed_store.mark_all_read(urls: urls)
      else
        @feed_store.mark_all_read
      end
      send_to(connection, type: "dashboard_updated")
    end

    def handle_dashboard_ask(connection, data)
      item_ids = data["item_ids"] || []
      question = data["question"] || "Give me a tactical briefing on these items."

      items = @feed_store.get_items(item_ids)

      context = items.map do |item|
        cat = @url_to_category[item["feed_url"]] || "other"
        "[#{cat.upcase}] #{item['title']}\n#{item['summary']}\nSource: #{item['link']}"
      end.join("\n\n")

      messages = [
        {
          role: "user",
          content: "Intelligence items for analysis:\n\n#{context}\n\nQuestion: #{question}"
        }
      ]

      claude = ClaudeClient.new(
        on_chunk: ->(chunk) {
          send_to(connection, type: "dashboard_analysis_chunk", text: chunk)
        },
        on_complete: ->(full_text) {
          send_to(connection, type: "dashboard_analysis_done", text: full_text)
        }
      )

      Thread.new { claude.query(messages) }
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
