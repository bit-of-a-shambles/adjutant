module Adjutant
  class Conversation
    MAX_HISTORY = 20

    def initialize
      @db = Adjutant.db
    end

    def add_message(role, content)
      @db.execute(
        "INSERT INTO messages (role, content) VALUES (?, ?)",
        [role, content]
      )
    end

    def recent_messages(limit = MAX_HISTORY)
      rows = @db.execute(
        "SELECT role, content FROM messages ORDER BY created_at DESC LIMIT ?",
        [limit]
      )
      rows.reverse.map { |r| { role: r["role"], content: r["content"] } }
    end

    def clear
      @db.execute("DELETE FROM messages")
    end
  end
end
