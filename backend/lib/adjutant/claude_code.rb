require "open3"
require "json"

module Adjutant
  class ClaudeCode
    CLAUDE_BIN = "claude"

    def initialize(on_chunk:, on_complete:, working_dir: nil)
      @on_chunk = on_chunk
      @on_complete = on_complete
      @working_dir = working_dir || Dir.home
    end

    # Run a task via Claude Code CLI.
    # This gives Adjutant the ability to read/write files, run commands,
    # search code, create commits — everything Claude Code can do.
    def run(task)
      full_response = ""

      Adjutant.logger.info("Claude Code task: #{task[0..80]}...")

      Open3.popen3(
        CLAUDE_BIN, "-p",
        "--output-format", "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
        task,
        chdir: @working_dir
      ) do |stdin, stdout, stderr, wait_thread|
        stdin.close

        stdout.each_line do |line|
          line.strip!
          next if line.empty?

          begin
            event = JSON.parse(line)
            handle_event(event, full_response)
          rescue JSON::ParserError
            # Not JSON, treat as raw text
            full_response << line
            @on_chunk.call(line)
          end
        end

        status = wait_thread.value
        unless status.success?
          err = stderr.read rescue ""
          Adjutant.logger.error("Claude Code exited with #{status.exitstatus}: #{err[0..200]}")
        end
      end

      @on_complete.call(full_response)
      full_response
    rescue => e
      error_msg = "Claude Code error: #{e.message}"
      Adjutant.logger.error(error_msg)
      @on_complete.call(error_msg)
      error_msg
    end

    private

    def handle_event(event, full_response)
      case event["type"]
      when "assistant"
        # Assistant message with content blocks
        if event["message"] && event["message"]["content"]
          event["message"]["content"].each do |block|
            case block["type"]
            when "text"
              text = block["text"] || ""
              full_response << text
              @on_chunk.call(text)
            when "tool_use"
              tool_name = block["name"] || "tool"
              tool_note = "[#{tool_name}] "
              @on_chunk.call(tool_note)
            end
          end
        end
      when "result"
        # Skip — the assistant messages already contain the full text.
        # The result event would duplicate it.
        nil
      end
    end
  end
end
