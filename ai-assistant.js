/* ==================== AI ASSISTANT - GROQ VERSION ==================== */

// AI State
let aiApiKey = localStorage.getItem("aiApiKey") || "";
let aiModel = localStorage.getItem("aiModel") || "llama-3.3-70b-versatile";
let aiConversationHistory = [];
let aiPendingAction = null;
let aiRetryTimeout = null;
const AI_STORAGE_KEY = "aiChatHistory";
const MAX_AI_HISTORY = 50;

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// System prompt for Groq (Llama)
const AI_SYSTEM_PROMPT = `Bạn là một trợ lý AI thông minh cho ứng dụng Lịch Việt. Bạn có thể:
1. Tạo sự kiện với tiêu đề, nội dung và ngày/giờ
2. Tạo ghi chú nhanh
3. Trả lời về lịch và sự kiện của người dùng
4. Chat trực tiếp với người dùng

Khi người dùng yêu cầu tạo sự kiện hoặc ghi chú, hãy:
- Trả lời bằng tiếng Việt
- Xác nhận thông tin với người dùng
- Nếu cần tạo sự kiện, trả lời theo định dạng JSON trong code block:
\`\`\`json
{
  "action": "create_event",
  "title": "Tiêu đề sự kiện",
  "text": "Nội dung sự kiện",
  "datetime": "YYYY-MM-DDTHH:MM"
}
\`\`\`
- Nếu cần tạo ghi chú, trả lời theo định dạng:
\`\`\`json
{
  "action": "create_note",
  "content": "Nội dung ghi chú"
}
\`\`\`
- Nếu là chat thông thường, chỉ cần trả lời bình thường

Ngày hiện tại: ${new Date().toLocaleDateString("vi-VN")}`;

function loadAIHistory() {
  try {
    const saved = localStorage.getItem(AI_STORAGE_KEY);
    if (saved) {
      aiConversationHistory = JSON.parse(saved);
    }
  } catch (e) {
    aiConversationHistory = [];
  }
}

function saveAIHistory() {
  try {
    if (aiConversationHistory.length > MAX_AI_HISTORY) {
      aiConversationHistory = aiConversationHistory.slice(-MAX_AI_HISTORY);
    }
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiConversationHistory));
  } catch (e) {
    console.error("Lỗi khi lưu lịch sử chat AI:", e);
  }
}

function openAIAssistantModal() {
  closeAllModals();
  document.getElementById("aiAssistantModal").style.display = "flex";
  
  loadAIHistory();
  updateAIStatus();
  renderAIChat();
  
  setTimeout(function() {
    const input = document.getElementById("aiInput");
    if (input) input.focus();
  }, 100);
}

function closeAIAssistantModal() {
  document.getElementById("aiAssistantModal").style.display = "none";
}

function startNewAIChat() {
  if (aiConversationHistory.length > 0) {
    if (confirm("Bạn có chắc muốn xóa lịch sử chat hiện tại và bắt đầu cuộc trò chuyện mới?")) {
      aiConversationHistory = [];
      saveAIHistory();
      renderAIChat();
      showToast("Đã xóa lịch sử chat");
    }
  }
}

function updateAIStatus() {
  const dot = document.getElementById("aiStatusDot");
  const modelInfo = document.getElementById("aiModelInfo");
  
  if (aiApiKey) {
    dot.className = "ai-status-dot ready";
    modelInfo.innerHTML = '<span class="ai-model-badge groq">Groq</span>';
  } else {
    dot.className = "ai-status-dot error";
    modelInfo.innerHTML = '<span class="ai-model-badge" style="color: #ef4444;">Chưa có API Key</span>';
  }
}

function renderAIChat() {
  const container = document.getElementById("aiChatContainer");
  const welcomeEl = document.getElementById("aiWelcomeMessage");
  
  if (aiConversationHistory.length === 0) {
    if (welcomeEl) welcomeEl.style.display = "block";
    const messages = container.querySelectorAll(".ai-message");
    messages.forEach(function(m) { m.remove(); });
    return;
  }
  
  if (welcomeEl) welcomeEl.style.display = "none";
  
  const messages = container.querySelectorAll(".ai-message");
  messages.forEach(function(m) { m.remove(); });
  
  aiConversationHistory.forEach(function(msg) {
    appendAIMessage(msg.role, msg.content, false);
  });
  
  container.scrollTop = container.scrollHeight;
}

function appendAIMessage(role, content, shouldSave) {
  shouldSave = shouldSave !== false;
  const container = document.getElementById("aiChatContainer");
  const welcomeEl = document.getElementById("aiWelcomeMessage");
  
  if (welcomeEl) welcomeEl.style.display = "none";
  
  const messageEl = document.createElement("div");
  messageEl.className = "ai-message " + (role === "assistant" ? "assistant" : "user");
  
  const avatarIcon = role === "assistant" 
    ? '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'
    : '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
  
  const renderedContent = renderMarkdown(content);
  
  messageEl.innerHTML = '<div class="ai-message-avatar"><svg viewBox="0 0 24 24" fill="currentColor">' + avatarIcon + '</svg></div><div class="ai-message-content">' + renderedContent + '</div>';
  
  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;
  
  if (shouldSave) {
    aiConversationHistory.push({ role: role, content: content });
    saveAIHistory();
  }
}

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/```json\n?([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$1</code></pre>');
  html = html.replace(/```\n?([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code class="ai-inline-code">$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function appendAITyping() {
  const container = document.getElementById("aiChatContainer");
  const typingEl = document.createElement("div");
  typingEl.className = "ai-message assistant";
  typingEl.id = "aiTypingMessage";
  typingEl.innerHTML = '<div class="ai-message-avatar"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div><div class="ai-message-content"><div class="ai-typing"><span></span><span></span><span></span></div></div>';
  container.appendChild(typingEl);
  container.scrollTop = container.scrollHeight;
}

function removeAITyping() {
  const typingEl = document.getElementById("aiTypingMessage");
  if (typingEl) typingEl.remove();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function sendAIMessage() {
  const input = document.getElementById("aiInput");
  const sendBtn = document.getElementById("aiSendBtn");
  
  if (!aiApiKey) {
    showAIError("Vui lòng nhập API Key để sử dụng Trợ lý AI");
    openAIKeyModal();
    return;
  }
  
  const message = input.value.trim();
  if (!message) return;
  
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;
  
  appendAIMessage("user", message);
  appendAITyping();
  
  try {
    const response = await callGroqAPI(message);
    removeAITyping();
    await processAIResponse(response);
  } catch (error) {
    removeAITyping();
    
    // Check if it's a rate limit error
    if (error.message.includes("rate_limit") || error.message.includes("429") || error.message.includes("quota")) {
      showAIError("Đang chờ... Thử lại sau 30s");
      appendAIMessage("assistant", "Bạn đã gặp giới hạn rate. Đang tự động thử lại sau 30 giây...");
      
      // Clear any existing retry timeout
      if (aiRetryTimeout) {
        clearTimeout(aiRetryTimeout);
      }
      
      // Schedule retry
      aiRetryTimeout = setTimeout(function() {
        aiRetryTimeout = null;
        input.value = message;
        sendAIMessage();
      }, 30000);
    } else {
      showAIError("Lỗi: " + error.message);
      appendAIMessage("assistant", "Xin lỗi, đã xảy ra lỗi: " + error.message);
    }
  }
  
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}

async function sendAICommand(command) {
  openAIAssistantModal();
  document.getElementById("aiInput").value = command;
  sendAIMessage();
}

async function callGroqAPI(message, retryCount) {
  retryCount = retryCount || 0;
  const maxRetries = 2;
  
  // Build messages array
  const messages = [
    { role: "system", content: AI_SYSTEM_PROMPT }
  ];
  
  // Add conversation history (last 10 messages)
  const historySlice = aiConversationHistory.slice(-10);
  historySlice.forEach(function(m) {
    messages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    });
  });
  
  // Add current message
  messages.push({ role: "user", content: message });
  
  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + aiApiKey
      },
      body: JSON.stringify({
        model: aiModel,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(function() { return { error: { message: "API Error" } }; });
      throw new Error(errorData.error ? errorData.error.message : "Lỗi API " + response.status);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Không nhận được phản hồi từ Groq");
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    // Retry on rate limit errors
    if ((error.message.includes("rate_limit") || error.message.includes("429") || error.message.includes("temporarily")) && retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount) * 1000;
      await new Promise(function(resolve) { setTimeout(resolve, waitTime); });
      return callGroqAPI(message, retryCount + 1);
    }
    throw error;
  }
}

async function processAIResponse(response) {
  const jsonMatch = response.match(/```json\n?([\s\S]*?)```/);
  
  if (jsonMatch) {
    try {
      const action = JSON.parse(jsonMatch[1]);
      
      if (action.action === "create_event") {
        showEventConfirmation(action);
        appendAIMessage("assistant", response);
      } else if (action.action === "create_note") {
        createQuickNoteFromAI(action.content);
        appendAIMessage("assistant", "Đã tạo ghi chú: " + action.content);
      } else {
        appendAIMessage("assistant", response);
      }
    } catch (e) {
      appendAIMessage("assistant", response);
    }
  } else {
    appendAIMessage("assistant", response);
  }
}

function showEventConfirmation(eventData) {
  aiPendingAction = { type: "create_event", data: eventData };

  const title = document.getElementById("aiActionTitle");
  const message = document.getElementById("aiActionMessage");
  const preview = document.getElementById("aiActionPreview");

  title.textContent = "Xác nhận tạo sự kiện";
  message.textContent = "Trợ lý AI muốn tạo sự kiện sau:";

  const eventDate = new Date(eventData.datetime);
  preview.innerHTML = "<strong>Tiêu đề:</strong> " + escapeHtml(eventData.title) + "<br><strong>Nội dung:</strong> " + escapeHtml(eventData.text || "Không có") + "<br><strong>Ngày/Giờ:</strong> " + eventDate.toLocaleString("vi-VN");

  document.getElementById("aiActionModal").style.display = "flex";
}

function closeAIActionModal() {
  document.getElementById("aiActionModal").style.display = "none";
  aiPendingAction = null;
}

function confirmAIAction() {
  if (!aiPendingAction) return;
  
  if (aiPendingAction.type === "create_event") {
    const data = aiPendingAction.data;
    
    const date = new Date(data.datetime);
    const dateKey = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    
    openAddEventModal(dateKey, date.getDate(), date.getMonth() + 1, date.getFullYear());
    document.getElementById("newEventTitle").value = data.title;
    document.getElementById("newEventText").value = data.text || "";
    document.getElementById("newEventDateTime").value = data.datetime;
    
    closeAIActionModal();
    closeAIAssistantModal();
    
    showToast("Đã điền thông tin sự kiện. Nhấn Lưu để xác nhận.");
  }
}

function createQuickNoteFromAI(content) {
  const key = QUICK_NOTE_STORAGE_KEY_PREFIX + userProfileKey;
  let notes = JSON.parse(localStorage.getItem(key) || "[]");
  
  notes.unshift({
    id: generateId(),
    content: content,
    createdAt: Date.now()
  });
  
  localStorage.setItem(key, JSON.stringify(notes));
  quickNotesCache = notes;
  
  if (firebaseReady && firebaseQuickNotesRef) {
    firebaseQuickNotesRef.set(notes);
  }
}

function showAIError(message) {
  const statusEl = document.getElementById("aiKeyStatus");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = "ai-key-status show error";
  }
}

function openAIKeyModal() {
  document.getElementById("aiKeyModal").style.display = "flex";
  
  const keyInput = document.getElementById("aiApiKeyInput");
  const modelSelect = document.getElementById("aiModelSelect");
  
  if (keyInput) keyInput.value = aiApiKey;
  if (modelSelect) modelSelect.value = aiModel || "gpt-4o-mini";
  
  document.getElementById("aiKeyStatus").className = "ai-key-status";
  document.getElementById("aiKeyStatus").textContent = "";
}

function closeAIKeyModal() {
  document.getElementById("aiKeyModal").style.display = "none";
}

function toggleAIKeyVisibility() {
  const input = document.getElementById("aiApiKeyInput");
  const icon = document.getElementById("aiKeyEyeIcon");
  
  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type = "password";
    icon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
  }
}

async function testAIKey() {
  const apiKey = document.getElementById("aiApiKeyInput").value.trim();
  const model = document.getElementById("aiModelSelect").value;
  const statusEl = document.getElementById("aiKeyStatus");
  
  statusEl.textContent = "Đang kiểm tra...";
  statusEl.className = "ai-key-status show";
  
  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(function() { return { error: { message: "Lỗi API" } }; });
      throw new Error(error.error ? error.error.message : "Lỗi API");
    }
    
    statusEl.innerHTML = '<span style="color: #10b981;">✓</span> Kết nối Groq thành công! <small>(Sẽ đồng bộ qua Firebase)</small>';
    statusEl.className = "ai-key-status show success";
  } catch (error) {
    statusEl.textContent = "Lỗi: " + error.message;
    statusEl.className = "ai-key-status show error";
  }
}

function saveAIKey() {
  const apiKey = document.getElementById("aiApiKeyInput").value.trim();
  const model = document.getElementById("aiModelSelect").value;
  
  aiApiKey = apiKey;
  aiModel = model;
  
  // Save to localStorage (backup)
  localStorage.setItem("aiApiKey", apiKey);
  localStorage.setItem("aiModel", model);
  
  // Save to Firebase for sync across devices
  if (typeof saveAISettingsToFirebase === "function") {
    saveAISettingsToFirebase(apiKey, model);
  }
  
  updateAIStatus();
  closeAIKeyModal();
  
  if (apiKey) {
    showToast("Đã lưu API Key Groq! (Đồng bộ đa thiết bị)");
  }
}

function getUserEventsForAI() {
  const today = new Date();
  const events = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateKey = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    const data = getDateData(dateKey);
    
    if (data.events && data.events.length > 0) {
      data.events.forEach(function(event) {
        events.push({
          date: dateKey,
          title: event.title,
          text: event.text,
          time: event.eventDateTime
        });
      });
    }
  }
  
  return events;
}

document.addEventListener("DOMContentLoaded", function() {
  const aiInput = document.getElementById("aiInput");
  if (aiInput) {
    aiInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendAIMessage();
      }
    });
    
    aiInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
  }
  
  const aiModal = document.getElementById("aiAssistantModal");
  if (aiModal) {
    aiModal.addEventListener("click", function(e) {
      if (e.target === this) closeAIAssistantModal();
    });
  }
  
  const aiKeyModal = document.getElementById("aiKeyModal");
  if (aiKeyModal) {
    aiKeyModal.addEventListener("click", function(e) {
      if (e.target === this) closeAIKeyModal();
    });
  }
  
  const aiActionModal = document.getElementById("aiActionModal");
  if (aiActionModal) {
    aiActionModal.addEventListener("click", function(e) {
      if (e.target === this) closeAIActionModal();
    });
  }
  
  const originalCloseAllModals = closeAllModals;
  closeAllModals = function() {
    if (typeof originalCloseAllModals === "function") {
      originalCloseAllModals();
    }
    document.getElementById("aiAssistantModal").style.display = "none";
    document.getElementById("aiKeyModal").style.display = "none";
    document.getElementById("aiActionModal").style.display = "none";
  };
});
