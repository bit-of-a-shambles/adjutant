require "yaml"
require "json"
require "sqlite3"
require "logger"

module Adjutant
  ROOT = File.expand_path("../..", __dir__)
  BACKEND_ROOT = File.expand_path("..", __dir__)

  class << self
    def config
      @config ||= load_config
    end

    def logger
      @logger ||= Logger.new($stdout, level: Logger::INFO, progname: "Adjutant")
    end

    def db
      @db ||= init_db
    end

    private

    def load_config
      settings_path = File.join(BACKEND_ROOT, "config", "settings.yml")
      feeds_path = File.join(BACKEND_ROOT, "config", "feeds.yml")

      settings = YAML.safe_load(File.read(settings_path), permitted_classes: [Symbol])
      feeds = YAML.safe_load(File.read(feeds_path), permitted_classes: [Symbol])

      settings.merge(feeds)
    end

    def init_db
      db_path = File.join(BACKEND_ROOT, "db", "adjutant.sqlite3")
      db = SQLite3::Database.new(db_path)
      db.results_as_hash = true

      # Run schema
      schema_path = File.join(BACKEND_ROOT, "db", "schema.sql")
      db.execute_batch(File.read(schema_path))

      db
    end
  end
end

require_relative "adjutant/config"
require_relative "adjutant/server"
require_relative "adjutant/claude_client"
require_relative "adjutant/voice_input"
require_relative "adjutant/voice_output"
require_relative "adjutant/claude_code"
require_relative "adjutant/screen_capture"
require_relative "adjutant/feed_manager"
require_relative "adjutant/feed_store"
require_relative "adjutant/context_manager"
require_relative "adjutant/conversation"
require_relative "adjutant/prompts"
