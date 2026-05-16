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

    def by_category(category, url_map, limit: 50, offset: 0)
      if category.nil? || category == "all"
        items = @db.execute(
          "SELECT * FROM feed_items ORDER BY pub_date DESC LIMIT ? OFFSET ?",
          [limit, offset]
        )
        total = @db.execute("SELECT COUNT(*) as c FROM feed_items").first["c"]
      else
        urls = url_map.select { |_u, c| c == category }.keys
        return { items: [], total: 0 } if urls.empty?

        placeholders = urls.map { "?" }.join(",")
        items = @db.execute(
          "SELECT * FROM feed_items WHERE feed_url IN (#{placeholders}) ORDER BY pub_date DESC LIMIT ? OFFSET ?",
          urls + [limit, offset]
        )
        total = @db.execute(
          "SELECT COUNT(*) as c FROM feed_items WHERE feed_url IN (#{placeholders})",
          urls
        ).first["c"]
      end

      { items: items, total: total }
    end

    def search(query, limit: 30)
      pattern = "%#{query}%"
      @db.execute(
        "SELECT * FROM feed_items WHERE title LIKE ? OR summary LIKE ? ORDER BY pub_date DESC LIMIT ?",
        [pattern, pattern, limit]
      )
    end

    def get_items(ids)
      return [] if ids.nil? || ids.empty?
      placeholders = ids.map { "?" }.join(",")
      @db.execute("SELECT * FROM feed_items WHERE id IN (#{placeholders})", ids)
    end

    def unread_counts
      @db.execute(
        "SELECT feed_url, COUNT(*) as count FROM feed_items WHERE read = 0 GROUP BY feed_url"
      )
    end

    def mark_all_read(urls: nil)
      if urls
        placeholders = urls.map { "?" }.join(",")
        @db.execute("UPDATE feed_items SET read = 1 WHERE feed_url IN (#{placeholders})", urls)
      else
        @db.execute("UPDATE feed_items SET read = 1")
      end
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
