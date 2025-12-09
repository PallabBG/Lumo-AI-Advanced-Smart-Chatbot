// ===== Global state =====
let lumoChats = [];
const HISTORY_KEY = "lumo-chat-history";
let conversation = [];

let lumoMemory = { name: null, age: null };
const MEMORY_KEY = "lumo-memory";

// ===== Send message to backend =====
function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (message === "") return;

  appendMessage(message, "user");

  // Copy history BEFORE adding this new message
  const historyForServer = conversation.slice();

  // Add this user message to local conversation
  conversation.push({ role: "user", text: message });

  // Show typing indicator
  const typingId = showTypingIndicator();

  fetch("/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      history: historyForServer   // 👈 send previous conversation
    })
  })
    .then(res => res.json())
    .then(data => {
      removeTypingIndicator(typingId);
      const reply = data.response || "No response received.";
      appendMessage(reply, "bot");

      // Add bot reply to conversation memory
      conversation.push({ role: "model", text: reply });
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

// ===== Append message to chat (with optional typing animation) =====
function appendMessage(message, sender, animate = false) {
  const box = document.getElementById("chat-box");
  if (!box) return;

  const row = document.createElement("div");
  row.classList.add("message-row", sender === "user" ? "user" : "bot");

  const avatar = document.createElement("div");
  avatar.classList.add("avatar", sender === "user" ? "user-avatar" : "bot-avatar");
  avatar.textContent = sender === "user" ? "Y" : "B"; // Y = You, B = Bot

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender === "user" ? "user-message" : "bot-message");

  const formatted = formatMarkdown(message);

  if (animate && sender === "bot") {
    typeWriterHtml(formatted, msgDiv);
  } else {
    msgDiv.innerHTML = formatted;
  }

  row.appendChild(avatar);
  row.appendChild(msgDiv);
  box.appendChild(row);

  // Auto scroll only if near bottom
  if (Math.abs(box.scrollHeight - box.scrollTop - box.clientHeight) < 120) {
    box.scrollTop = box.scrollHeight;
  }
}

// ===== Simple HTML "typewriter" effect =====
function typeWriterHtml(html, element, speed = 15) {
  let i = 0;
  const len = html.length;
  const box = document.getElementById("chat-box");

  const interval = setInterval(() => {
    element.innerHTML = html.slice(0, i);
    i++;

    if (box) {
      box.scrollTop = box.scrollHeight;
    }

    if (i > len) {
      clearInterval(interval);
    }
  }, speed);
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

// ===== Memory helpers (very simple, for name & age) =====
function loadMemory() {
  const raw = localStorage.getItem(MEMORY_KEY);
  if (raw) {
    try {
      lumoMemory = JSON.parse(raw);
    } catch (e) {
      lumoMemory = { name: null, age: null };
    }
  }
}

function saveMemory() {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(lumoMemory));
}

function updateMemoryFromUser(text) {
  if (!text) return;

  // Name patterns: "My name is Pallab", "I'm Pallab", "I am Pallab"
  const nameMatch =
    text.match(/my name is\s+([a-zA-Z ]+)/i) ||
    text.match(/i am\s+([a-zA-Z ]+)/i) ||
    text.match(/i'm\s+([a-zA-Z ]+)/i);

  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name) lumoMemory.name = name;
  }

  // Age patterns: "I'm 20 years old", "I am 20 years old"
  const ageMatch = text.match(/(\d{1,3})\s*(years old|year old|yrs old)?/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (!isNaN(age)) lumoMemory.age = age;
  }
}

function maybeHandleMemoryQuestion(text) {
  if (!text) return null;

  // Simple check like: "give me my name and age" / "tell me my name and my age"
  const askPattern = /(give|tell)\s+me\s+my\s+name\s+and\s+my\s+age/i;
  if (askPattern.test(text)) {
    const name = lumoMemory.name
      ? lumoMemory.name
      : "(not told yet)";
    const age =
      lumoMemory.age !== null
        ? lumoMemory.age
        : "(not told yet)";

    return `Here is what I remember:\n\nName: ${name}\nAge: ${age}`;
  }

  return null;
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

  // Don't save if there is no user message yet
  const hasUserMsg = chatBox.querySelector(".user-message");
  if (!hasUserMsg) return;

  const content = chatBox.innerHTML.trim();
  if (!content) return;

  // Avoid saving exact duplicate of last saved chat
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
  const list = document.getElementById("history-list");
  if (list) {
    list.innerHTML = "";
    if (lumoChats.length === 0) {
      const p = document.createElement("p");
      p.className = "history-empty";
      p.textContent = "No saved chats yet.";
      list.appendChild(p);
      return;
    }

    // Newest first
    [...lumoChats].slice().reverse().forEach(chat => {
      const li = document.createElement("li");
      li.className = "history-item";
      li.textContent = chat.title;
      li.addEventListener("click", () => {
        loadChatById(chat.id);
      });
      list.appendChild(li);
    });
  }
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
  // Load memory & history
  loadMemory();
  loadHistoryFromStorage();

  // Input: Enter = send, Shift+Enter = newline
  const input = document.getElementById("user-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      // Shift+Enter → normal (newline)
    });
  }

  // New Chat button
    const newChatBtn = document.getElementById("new-chat");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      const chatBox = document.getElementById("chat-box");

      // Save current chat BEFORE clearing
      saveCurrentChatToHistory();

      // Reset in-memory conversation
      conversation = [];

      // Clear and start fresh
      chatBox.innerHTML = "";
      const greeting = "Hi, I’m Lumo — your AI assistant. How can I help you today? 🙂";
      appendMessage(greeting, "bot");
      conversation.push({ role: "model", text: greeting });
    });
  }

  

  // Sidebar toggle (3-line menu) for small screens
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidePanel = document.querySelector(".side-panel");

  if (sidebarToggle && sidePanel) {
    sidebarToggle.addEventListener("click", () => {
      // For mobile: slide in/out
      sidePanel.classList.toggle("open");
      // For desktop: show/hide panel
      document.body.classList.toggle("sidebar-hidden");
    });
  }

  // Theme
  initTheme();
});
