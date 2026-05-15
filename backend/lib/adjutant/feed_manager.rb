require "feedjira"
require "rufus-scheduler"
require "open-uri"

module Adjutant
  class FeedManager
    def initialize(config, store:, on_new_items: nil)
      @feeds = config.feeds
      @store = store
      @on_new_items = on_new_items
      @scheduler = Rufus::Scheduler.new
    end

    def start
      Adjutant.logger.info("Starting feed manager with #{@feeds.length} feeds")

      @feeds.each do |feed_config|
        interval = "#{feed_config['refresh_minutes'] || 15}m"

        # Poll once immediately, then on schedule
        poll_feed(feed_config)

        @scheduler.every(interval) do
          poll_feed(feed_config)
        end
      end
    end

    def stop
      @scheduler.shutdown
    end

    private

    def poll_feed(feed_config)
      url = feed_config["url"]
      Adjutant.logger.info("Polling feed: #{url}")

      xml = URI.open(url).read
      feed = Feedjira.parse(xml)
      new_items = []

      feed.entries.each do |entry|
        guid = entry.entry_id || entry.url || entry.title
        was_new = @store.insert(
          feed_url: url,
          guid: guid,
          title: entry.title,
          summary: entry.summary&.slice(0, 500),
          link: entry.url,
          pub_date: entry.published
        )
        new_items << { title: entry.title, link: entry.url } if was_new
      end

      if new_items.any? && @on_new_items
        @on_new_items.call(new_items)
      end
    rescue => e
      Adjutant.logger.error("Feed poll error (#{url}): #{e.message}")
    end
  end
end
