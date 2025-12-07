// ===== Global history state =====
let lumoChats = [];
const HISTORY_KEY = "lumo-chat-history";

// ===== Send message to backend =====
function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (message === "") return;

  appendMessage(message, "user");

  // Show typing indicator
  const typingId = showTypingIndicator();

  fetch("/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  })
    .then(res => res.json())
    .then(data => {
      removeTypingIndicator(typingId);
      appendMessage(data.response || "No response received.", "bot");
    })
    .catch(err => {
      console.error(err);
      removeTypingIndicator(typingId);
      appendMessage("Sorry, something went wrong. Please try again.", "bot");
    });

  input.value = "";
}

// ===== Markdown formatter =====
function formatMarkdown(text) {
  if (!text) return "";

  // Escape HTML
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text**
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic *text*
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Inline code `code`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Code blocks ```code```
  text = text.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Bullet list lines "* something" or "- something"
  text = text.replace(/^\s*[-*]\s+(.*)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> in <ul>
  text = text.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");

  // New lines
  text = text.replace(/\n/g, "<br>");

  return text;
}

// ===== Append message to chat =====
function appendMessage(message, sender) {
  const box = document.getElementById("chat-box");
  if (!box) return;

  const row = document.createElement("div");
  row.classList.add("message-row", sender === "user" ? "user" : "bot");

  const avatar = document.createElement("div");
  avatar.classList.add("avatar", sender === "user" ? "user-avatar" : "bot-avatar");
  avatar.textContent = sender === "user" ? "Y" : "B"; // Y = You, B = Bot

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender === "user" ? "user-message" : "bot-message");

  // 👉 Use markdown formatting for BOTH user & bot
  msgDiv.innerHTML = formatMarkdown(message);

  row.appendChild(avatar);
  row.appendChild(msgDiv);

  box.appendChild(row);

  // Auto scroll only if near bottom
  if (Math.abs(box.scrollHeight - box.scrollTop - box.clientHeight) < 120) {
    box.scrollTop = box.scrollHeight;
  }
}

// ===== Typing indicator =====
function showTypingIndicator() {
  const box = document.getElementById("chat-box");
  if (!box) return null;

  const row = document.createElement("div");
  row.classList.add("message-row", "bot");
  const avatar = document.createElement("div");
  avatar.classList.add("avatar", "bot-avatar");
  avatar.textContent = "B";

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", "bot-message");

  const wrapper = document.createElement("div");
  wrapper.classList.add("typing-indicator");

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.classList.add("typing-dot");
    wrapper.appendChild(dot);
  }

  msgDiv.appendChild(wrapper);
  row.appendChild(avatar);
  row.appendChild(msgDiv);

  const id = "typing-" + Date.now();
  row.dataset.id = id;

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;

  return id;
}

function removeTypingIndicator(id) {
  const box = document.getElementById("chat-box");
  if (!box) return;
  const rows = box.querySelectorAll("[data-id]");
  rows.forEach(row => {
    if (row.dataset.id === id) {
      box.removeChild(row);
    }
  });
}

// ===== Suggestion button helper =====
function setSuggestion(text) {
  const input = document.getElementById("user-input");
  input.value = text;
  input.focus();
}

// ===== Dark mode toggle =====
function initTheme() {
  const savedTheme = localStorage.getItem("chatbot-theme");
  const body = document.body;
  const toggleBtn = document.getElementById("theme-toggle");

  if (savedTheme === "dark") {
    body.classList.add("dark");
    if (toggleBtn) toggleBtn.textContent = "☀️";
  } else {
    body.classList.remove("dark");
    if (toggleBtn) toggleBtn.textContent = "🌙";
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      body.classList.toggle("dark");
      const isDark = body.classList.contains("dark");
      localStorage.setItem("chatbot-theme", isDark ? "dark" : "light");
      toggleBtn.textContent = isDark ? "☀️" : "🌙";
    });
  }
}

// ===== Chat history helpers =====
function loadHistoryFromStorage() {
  const raw = localStorage.getItem(HISTORY_KEY);
  lumoChats = raw ? JSON.parse(raw) : [];
  renderHistoryOptions();
}

function saveCurrentChatToHistory() {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  // 🔹 Don't save if there is no user message yet
  const hasUserMsg = chatBox.querySelector(".user-message");
  if (!hasUserMsg) return;

  const content = chatBox.innerHTML.trim();
  if (!content) return;

  // 🔹 Avoid saving exact duplicate of last saved chat
  const last = lumoChats[lumoChats.length - 1];
  if (last && last.content === content) {
    return;
  }

  const text = chatBox.textContent.replace(/\s+/g, " ").trim();
  const short = text.slice(0, 40) || "Conversation";
  const title = short + " — " + new Date().toLocaleTimeString();

  const chat = {
    id: Date.now(),
    title,
    content
  };

  lumoChats.push(chat);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(lumoChats));
  renderHistoryOptions();
}


function renderHistoryOptions() {
  const select = document.getElementById("chat-history");
  if (!select) return;

  select.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "History";
  select.appendChild(defaultOpt);

  lumoChats.forEach(chat => {
    const opt = document.createElement("option");
    opt.value = chat.id;
    opt.textContent = chat.title;
    select.appendChild(opt);
  });
}

function loadChatById(id) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;
  const chat = lumoChats.find(c => String(c.id) === String(id));
  if (!chat) return;
  chatBox.innerHTML = chat.content;
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ===== DOM Ready =====
document.addEventListener("DOMContentLoaded", () => {
  // Input + Enter to send
  const input = document.getElementById("user-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // New Chat button
  const newChatBtn = document.getElementById("new-chat");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      const chatBox = document.getElementById("chat-box");

      // ✅ Save current chat BEFORE clearing (only if it has user messages)
      saveCurrentChatToHistory();

      // Clear and start fresh
      chatBox.innerHTML = "";
      appendMessage("Hi, I’m Lumo — your AI assistant. How can I help you today? 🙂", "bot");
    });
  }

  // History dropdown (declare ONCE)
  const historySelect = document.getElementById("chat-history");
  if (historySelect) {
    historySelect.addEventListener("change", (e) => {
      const id = e.target.value;
      if (!id) return;

      // ✅ Just load selected chat, do NOT save or reset value
      loadChatById(id);
    });
  }

  // 🗑 Delete selected chat from history
  const clearBtn = document.getElementById("clear-history");
  if (clearBtn && historySelect) {
    clearBtn.addEventListener("click", () => {
      const selectedId = historySelect.value;

      if (!selectedId) {
        alert("Please select a chat from History to delete.");
        return;
      }

      const confirmed = confirm("Delete this chat from history?");
      if (!confirmed) return;

      // Remove only the selected chat
      lumoChats = lumoChats.filter(c => String(c.id) !== String(selectedId));
      if (lumoChats.length === 0) {
        localStorage.removeItem(HISTORY_KEY);
      } else {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(lumoChats));
      }

      // Rebuild dropdown and reset selection
      renderHistoryOptions();
      historySelect.value = "";
    });
  }

  // Load existing history + theme
  loadHistoryFromStorage();
  initTheme();
});
