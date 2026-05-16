/**
 * Adjutant Intelligence Console — Dashboard
 */

const { shell } = require('electron');

// =====================================================================
// STATE
// =====================================================================
const state = {
  currentCategory: 'all',
  selectedIds: new Set(),
  items: [],
  unreadCounts: {},
  searchTimeout: null,
  analysisBuffer: '',
};

// =====================================================================
// WEBSOCKET
// =====================================================================
let ws = null;
const wsUrl = 'ws://127.0.0.1:9247';

function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Dashboard connected');
    fetchFeeds();
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };

  ws.onclose = () => {
    console.log('Disconnected, reconnecting...');
    setTimeout(connect, 3000);
  };

  ws.onerror = () => {};
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function handleMessage(data) {
  switch (data.type) {
    case 'dashboard_feeds_result':
      state.items = data.items;
      state.unreadCounts = data.unread_counts || {};
      renderFeedList();
      renderUnreadCounts();
      break;

    case 'dashboard_search_result':
      state.items = data.items;
      renderFeedList();
      break;

    case 'dashboard_updated':
      // Re-fetch current view
      fetchFeeds();
      break;

    case 'dashboard_analysis_chunk':
      state.analysisBuffer += data.text;
      renderAnalysis();
      break;

    case 'dashboard_analysis_done':
      // Analysis complete
      break;

    case 'feed_items':
      // New items broadcast — refresh if viewing all or matching category
      fetchFeeds();
      break;

    case 'state':
    case 'pong':
    case 'transcript':
    case 'stream_chunk':
    case 'speak':
      // These are for the HUD overlay, ignore in dashboard
      break;
  }
}

// =====================================================================
// API
// =====================================================================
function fetchFeeds() {
  send({
    type: 'dashboard_feeds',
    category: state.currentCategory,
    limit: 100,
    offset: 0,
  });
}

function searchFeeds(query) {
  if (!query.trim()) {
    fetchFeeds();
    return;
  }
  send({ type: 'dashboard_search', query: query.trim() });
}

function markRead(id) {
  send({ type: 'dashboard_mark_read', id: id });
}

function markAllRead() {
  send({ type: 'dashboard_mark_all_read', category: state.currentCategory });
}

function askAdjutant(itemIds, question) {
  state.analysisBuffer = '';
  showAnalysisPanel();
  renderAnalysis();
  send({
    type: 'dashboard_ask',
    item_ids: Array.from(itemIds),
    question: question,
  });
}

// =====================================================================
// RENDERING
// =====================================================================
const feedList = document.getElementById('feed-list');
const resultCount = document.getElementById('result-count');
const unreadCountEl = document.getElementById('unread-count');
const analysisPanel = document.getElementById('analysis-panel');
const analysisContent = document.getElementById('analysis-content');

function renderFeedList() {
  if (state.items.length === 0) {
    feedList.innerHTML = '<div class="empty-state"><div class="icon">◇</div>NO INTELLIGENCE DATA</div>';
    resultCount.textContent = '';
    return;
  }

  resultCount.textContent = `${state.items.length} items`;

  feedList.innerHTML = state.items.map(item => {
    const isSelected = state.selectedIds.has(item.id);
    const isRead = item.read === 1;
    const timeAgo = formatTimeAgo(item.pub_date);
    const category = (item.category || 'other').toUpperCase();
    const summary = item.summary || '';

    return `
      <div class="feed-item ${isRead ? 'read' : ''} ${isSelected ? 'selected' : ''}"
           data-id="${item.id}" data-link="${item.link || ''}">
        <div class="feed-item-header">
          ${!isRead ? '<div class="unread-dot"></div>' : ''}
          <div class="feed-item-title">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="feed-item-meta">
            <span class="feed-item-category">${category}</span>
            <span>${timeAgo}</span>
          </div>
        </div>
        ${summary ? `<div class="feed-item-summary">${escapeHtml(stripHtml(summary))}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderUnreadCounts() {
  let total = 0;
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(nav => {
    const cat = nav.dataset.category;
    const badge = nav.querySelector('.nav-badge');
    if (badge) badge.remove();

    if (cat === 'all') {
      // Sum all
      total = Object.values(state.unreadCounts).reduce((a, b) => a + b, 0);
      if (total > 0) {
        const b = document.createElement('span');
        b.className = 'nav-badge';
        b.textContent = total;
        nav.appendChild(b);
      }
    } else {
      const count = state.unreadCounts[cat] || 0;
      if (count > 0) {
        const b = document.createElement('span');
        b.className = 'nav-badge';
        b.textContent = count;
        nav.appendChild(b);
      }
    }
  });

  unreadCountEl.textContent = total;
}

function renderAnalysis() {
  if (!state.analysisBuffer) {
    analysisContent.innerHTML = '<div class="loading">PROCESSING INTELLIGENCE...</div>';
  } else {
    analysisContent.textContent = state.analysisBuffer;
    analysisContent.scrollTop = analysisContent.scrollHeight;
  }
}

function showAnalysisPanel() {
  analysisPanel.classList.remove('hidden');
  document.getElementById('dashboard').classList.add('analysis-open');
}

function hideAnalysisPanel() {
  analysisPanel.classList.add('hidden');
  document.getElementById('dashboard').classList.remove('analysis-open');
}

// =====================================================================
// HELPERS
// =====================================================================
function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function stripHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent || '';
}

// =====================================================================
// EVENT HANDLERS
// =====================================================================

// Sidebar navigation
document.getElementById('nav-items').addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item');
  if (!nav) return;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  nav.classList.add('active');

  state.currentCategory = nav.dataset.category;
  state.selectedIds.clear();
  document.getElementById('search-input').value = '';
  fetchFeeds();
});

// Feed item click — toggle selection
feedList.addEventListener('click', (e) => {
  const item = e.target.closest('.feed-item');
  if (!item) return;

  const id = parseInt(item.dataset.id);

  if (e.metaKey || e.ctrlKey) {
    // Multi-select
    if (state.selectedIds.has(id)) {
      state.selectedIds.delete(id);
    } else {
      state.selectedIds.add(id);
    }
  } else {
    // Single select
    state.selectedIds.clear();
    state.selectedIds.add(id);
  }

  // Mark as read
  const feedItem = state.items.find(i => i.id === id);
  if (feedItem && !feedItem.read) {
    feedItem.read = 1;
    markRead(id);
  }

  renderFeedList();
});

// Double-click — open link
feedList.addEventListener('dblclick', (e) => {
  const item = e.target.closest('.feed-item');
  if (!item || !item.dataset.link) return;
  shell.openExternal(item.dataset.link);
});

// Search
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(state.searchTimeout);
  state.searchTimeout = setTimeout(() => {
    searchFeeds(e.target.value);
  }, 300);
});

// Ask Adjutant
function submitAsk() {
  const input = document.getElementById('ask-input');
  const question = input.value.trim();
  if (!question && state.selectedIds.size === 0) return;

  const ids = state.selectedIds.size > 0
    ? state.selectedIds
    : new Set(state.items.slice(0, 10).map(i => i.id));

  askAdjutant(ids, question || 'Analyze these intelligence items and provide a tactical briefing.');
  input.value = '';
}

document.getElementById('ask-btn').addEventListener('click', submitAsk);
document.getElementById('ask-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAsk();
});

// Briefing button
document.getElementById('briefing-btn').addEventListener('click', () => {
  const unreadItems = state.items.filter(i => !i.read);
  const ids = unreadItems.length > 0
    ? new Set(unreadItems.slice(0, 20).map(i => i.id))
    : new Set(state.items.slice(0, 20).map(i => i.id));

  askAdjutant(ids, 'Give me a tactical intelligence briefing on these items. Prioritize by significance and actionability. Identify key themes and threats.');
});

// Mark all read
document.getElementById('mark-all-read-btn').addEventListener('click', () => {
  markAllRead();
});

// Close analysis panel
document.getElementById('analysis-close').addEventListener('click', hideAnalysisPanel);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape closes analysis
  if (e.key === 'Escape') {
    hideAnalysisPanel();
    return;
  }

  // Don't handle shortcuts when typing in inputs
  if (e.target.tagName === 'INPUT') return;

  const items = document.querySelectorAll('.feed-item');
  const currentIdx = Array.from(items).findIndex(el => el.classList.contains('selected'));

  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = Math.min(currentIdx + 1, items.length - 1);
    if (items[nextIdx]) {
      state.selectedIds.clear();
      state.selectedIds.add(parseInt(items[nextIdx].dataset.id));
      renderFeedList();
      items[nextIdx].scrollIntoView({ block: 'nearest' });
    }
  } else if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIdx = Math.max(currentIdx - 1, 0);
    if (items[prevIdx]) {
      state.selectedIds.clear();
      state.selectedIds.add(parseInt(items[prevIdx].dataset.id));
      renderFeedList();
      items[prevIdx].scrollIntoView({ block: 'nearest' });
    }
  } else if (e.key === 'Enter') {
    // Open selected item link
    const selected = document.querySelector('.feed-item.selected');
    if (selected && selected.dataset.link) {
      shell.openExternal(selected.dataset.link);
    }
  } else if (e.key === 'a') {
    // Focus ask input
    document.getElementById('ask-input').focus();
  }
});

// =====================================================================
// INIT
// =====================================================================
if (window.adjutant) {
  window.adjutant.onInit(() => connect());
} else {
  connect();
}
