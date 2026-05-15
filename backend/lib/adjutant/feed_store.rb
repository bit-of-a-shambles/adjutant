module Adjutant
  class FeedStore
    def initialize
      @db = Adjutant.db
    end

    def insert(feed_url:, guid:, title:, summary:, link:, pub_date:)
      @db.execute(
        "INSERT OR IGNORE INTO feed_items (feed_url, guid, title, summary, link, pub_date) VALUES (?, ?, ?, ?, ?, ?)",
        [feed_url, guid, title, summary, link, pub_date&.to_s]
      )
      @db.changes > 0 # true if inserted (new item)
    end

    def recent(limit = 20, unread_only: false)
      query = "SELECT * FROM feed_items"
      query += " WHERE read = 0" if unread_only
      query += " ORDER BY pub_date DESC LIMIT ?"

      @db.execute(query, [limit])
    end

    def mark_read(id)
      @db.execute("UPDATE feed_items SET read = 1 WHERE id = ?", [id])
    end

    def recent_digest(hours: 6, limit: 15)
      cutoff = (Time.now - hours * 3600).strftime("%Y-%m-%d %H:%M:%S")
      items = @db.execute(
        "SELECT title, link, feed_url, pub_date FROM feed_items WHERE created_at > ? ORDER BY pub_date DESC LIMIT ?",
        [cutoff, limit]
      )

      return "No recent intelligence." if items.empty?

      items.map { |i| "- #{i['title']} (#{i['feed_url']})" }.join("\n")
    end
  end
end
