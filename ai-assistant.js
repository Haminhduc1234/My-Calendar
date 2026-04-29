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

// Get user data context for AI - reads directly from Firebase
async function getUserDataContext() {
  let context = "";
  const today = new Date();
  
  try {
    // Fetch all data from Firebase directly
    const [datesSnap, notesSnap, projectsSnap, translateSnap] = await Promise.all([
      firebaseDatesRef ? firebaseDatesRef.once("value") : Promise.resolve(null),
      firebaseQuickNotesRef ? firebaseQuickNotesRef.once("value") : Promise.resolve(null),
      firebaseProjectsRef ? firebaseProjectsRef.once("value") : Promise.resolve(null),
      firebaseTranslateHistoryRef ? firebaseTranslateHistoryRef.once("value") : Promise.resolve(null)
    ]);
    
    // Process events from Firebase
    const events = [];
    if (datesSnap) {
      const allDates = datesSnap.val() || {};
      const dateKeys = Object.keys(allDates).sort();
      
      dateKeys.forEach(dateKey => {
        const data = allDates[dateKey];
        if (data && data.events && data.events.length > 0) {
          data.events.forEach(event => {
            events.push({
              date: dateKey,
              title: event.title || "Không có tiêu đề",
              text: event.text || "",
              time: event.eventDateTime || ""
            });
          });
        }
      });
    }
    
    // Get quick notes from Firebase
    let quickNotes = [];
    if (notesSnap) {
      const notesData = notesSnap.val();
      if (Array.isArray(notesData)) {
        quickNotes = notesData;
      } else if (notesData && typeof notesData === "object") {
        quickNotes = Object.values(notesData);
      }
    }
    
    // Get projects from Firebase
    let projects = {};
    if (projectsSnap) {
      projects = projectsSnap.val() || {};
    }
    
    // Get translate history from Firebase
    let translateHistory = [];
    if (translateSnap) {
      const translateData = translateSnap.val();
      if (Array.isArray(translateData)) {
        translateHistory = translateData;
      } else if (translateData && typeof translateData === "object") {
        translateHistory = Object.values(translateData).sort((a, b) => 
          new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        );
      }
    }
    
    // Build context string
    context += "=== DỮ LIỆU NGƯỜI DÙNG (TỪ FIREBASE) ===\n\n";
    
    if (events.length > 0) {
      context += "📅 SỰ KIỆN:\n";
      // Show events from past 30 days to next 90 days
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const ninetyDaysLater = new Date(today);
      ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
      
      events.forEach(event => {
        const eventDate = new Date(event.date);
        if (eventDate >= thirtyDaysAgo && eventDate <= ninetyDaysLater) {
          context += `- ${event.date}: ${event.title}`;
          if (event.time) context += ` (${event.time})`;
          if (event.text) context += ` - ${event.text}`;
          context += "\n";
        }
      });
      context += "\n";
    } else {
      context += "📅 SỰ KIỆN: Chưa có sự kiện nào\n\n";
    }
    
    if (quickNotes.length > 0) {
      context += "📝 GHI CHÚ NHANH:\n";
      quickNotes.slice(0, 20).forEach(note => {
        context += `- ${note.text || note.content || note}`;
        if (note.createdAt) {
          const noteDate = new Date(note.createdAt);
          context += ` (${noteDate.toLocaleDateString("vi-VN")})`;
        }
        if (note.done) context += " ✓";
        context += "\n";
      });
      context += "\n";
    } else {
      context += "📝 GHI CHÚ NHANH: Chưa có ghi chú nào\n\n";
    }
    
    if (projects && Object.keys(projects).length > 0) {
      context += "📋 DỰ ÁN:\n";
      Object.values(projects).slice(0, 10).forEach(project => {
        context += `- ${project.name || project.title || "Dự án không tên"}`;
        if (project.status) context += ` [${project.status}]`;
        if (project.description) context += `: ${project.description}`;
        context += "\n";
        if (project.tasks) {
          Object.values(project.tasks).slice(0, 5).forEach(task => {
            if (task.text || task.title) {
              context += `  • ${task.text || task.title}`;
              if (task.completed) context += " ✓";
              context += "\n";
            }
          });
        }
      });
      context += "\n";
    } else {
      context += "📋 DỰ ÁN: Chưa có dự án nào\n\n";
    }
    
    if (translateHistory.length > 0) {
      const langNames = {
        "vi": "Tiếng Việt",
        "en": "Tiếng Anh",
        "zh": "Tiếng Trung",
        "ja": "Tiếng Nhật",
        "ko": "Tiếng Hàn",
        "fr": "Tiếng Pháp",
        "de": "Tiếng Đức",
        "es": "Tiếng Tây Ban Nha",
        "ru": "Tiếng Nga",
        "th": "Tiếng Thái"
      };
      
      context += "🌐 LỊCH SỬ DỊCH:\n";
      translateHistory.slice(0, 15).forEach(item => {
        const date = new Date(item.timestamp);
        const fromLang = langNames[item.fromLang] || item.fromLang || "N/A";
        const toLang = langNames[item.toLang] || item.toLang || "N/A";
        context += `- [${date.toLocaleDateString("vi-VN")}] ${item.original || ""} → ${item.translated || ""} (${fromLang} → ${toLang})\n`;
      });
      context += "\n";
    } else {
      context += "🌐 LỊCH SỬ DỊCH: Chưa có lịch sử dịch nào\n\n";
    }
    
  } catch (err) {
    console.error("Error fetching user data for AI:", err);
    context += "⚠️ Không thể tải dữ liệu từ Firebase\n\n";
  }
  
  return context;
}


// Dynamic system prompt with user data (async)
async function getSystemPrompt() {
  const userData = await getUserDataContext();
  const currentDate = new Date().toLocaleDateString("vi-VN", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return `Bạn là một trợ lý AI thông minh cho ứng dụng Lịch Việt.

${userData}

=== HƯỚNG DẪN TRẢ LỜI ===

1. KHI TRẢ LỜI VỀ LỊCH/SỰ KIỆN:
   - Dựa vào dữ liệu sự kiện ở trên để trả lời
   - Nếu hỏi "hôm nay có gì", hãy tìm sự kiện của ngày hiện tại
   - Nếu hỏi về tuần/tháng, hãy liệt kê các sự kiện trong khoảng thời gian đó
   - Trả lời bằng tiếng Việt, thân thiện và chi tiết

2. KHI TRẢ LỜI VỀ GHI CHÚ:
   - Dựa vào danh sách ghi chú ở trên
   - Có thể tìm kiếm, tổng hợp thông tin từ nhiều ghi chú
   - Khi được hỏi về ghi chú cũ, hãy tìm và trích dẫn chính xác

3. KHI TRẢ LỜI VỀ DỰ ÁN:
   - Dựa vào danh sách dự án và công việc ở trên
   - Cập nhật tiến độ, trạng thái dự án
   - Liệt kê công việc đã hoàn thành và chưa hoàn thành

4. KHI TRẢ LỜI VỀ LỊCH SỬ DỊCH:
   - Dựa vào lịch sử dịch ở trên
   - Có thể tìm bản dịch cũ hoặc tổng hợp các từ đã dịch
   - Giải thích nghĩa của từ/cụm từ đã dịch

5. KHI TẠO SỰ KIỆN/GHI CHÚ/DỰ ÁN/CÔNG VIỆC:
   - Luôn xác nhận với người dùng trước khi tạo
   - Trả lời theo định dạng JSON:
   
   Tạo sự kiện:
\`\`\`json
{
  "action": "create_event",
  "title": "Tiêu đề sự kiện",
  "text": "Nội dung mô tả",
  "datetime": "2026-04-28T14:00"
}
\`\`\`
   
   Tạo ghi chú nhanh:
\`\`\`json
{
  "action": "create_note",
  "content": "Nội dung ghi chú"
}
\`\`\`
   
   Tạo dự án mới:
\`\`\`json
{
  "action": "create_project",
  "title": "Tên dự án mới",
  "description": "Mô tả chi tiết về dự án"
}
\`\`\`
   
   Tạo công việc trong dự án (cần chỉ định projectTitle để tìm dự án):
\`\`\`json
{
  "action": "create_task",
  "projectTitle": "Tên dự án đã có",
  "title": "Tên công việc cần làm",
  "description": "Mô tả công việc"
}
\`\`\`

6. KHI TRẢ LỜI CÂU HỎI CHUNG:

Hãy trả lời một cách tự nhiên, thân thiện và hữu ích nhất! Nếu người dùng hỏi về dữ liệu của họ, hãy dựa vào thông tin ở trên để trả lời chính xác.`;
}

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
    if (dot) dot.className = "ai-status-dot ready";
    if (modelInfo) modelInfo.innerHTML = '<span class="ai-model-badge groq">Groq</span>';
  } else {
    if (dot) dot.className = "ai-status-dot error";
    if (modelInfo) modelInfo.innerHTML = '<span class="ai-model-badge" style="color: #ef4444;">Chưa có API Key</span>';
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
  setTimeout(function() {
    const input = document.getElementById("aiInput");
    if (input) {
      input.value = command;
      input.focus();
      sendAIMessage();
    }
  }, 200);
}

async function callGroqAPI(message, retryCount) {
  retryCount = retryCount || 0;
  const maxRetries = 2;
  
  // Build messages array with dynamic system prompt including user data
  const systemPrompt = await getSystemPrompt();
  const messages = [
    { role: "system", content: systemPrompt }
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
        max_tokens: 1500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(function() { return { error: { message: "Lỗi API" } }; });
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
        showNoteConfirmation(action.content);
        appendAIMessage("assistant", response);
      } else if (action.action === "create_project") {
        showProjectConfirmation(action.title, action.description);
        appendAIMessage("assistant", response);
      } else if (action.action === "create_task") {
        showTaskConfirmation(action.projectTitle, action.title, action.description);
        appendAIMessage("assistant", response);
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
  } else if (aiPendingAction.type === "create_note") {
    createQuickNoteFromAI(aiPendingAction.data);
    closeAIActionModal();
    appendAIMessage("assistant", "Đã tạo ghi chú: " + aiPendingAction.data);
    showToast("Đã tạo ghi chú thành công!");
  } else if (aiPendingAction.type === "create_project") {
    createProjectFromAI(aiPendingAction.data.title, aiPendingAction.data.description);
    closeAIActionModal();
    appendAIMessage("assistant", "Đã tạo dự án: " + aiPendingAction.data.title);
    showToast("Đã tạo dự án thành công!");
  } else if (aiPendingAction.type === "create_task") {
    // If projectId not resolved yet, resolve it now
    if (!aiPendingAction.data.projectId) {
      findProjectByTitle(aiPendingAction.data.projectTitle).then(foundProject => {
        if (foundProject) {
          createTaskFromAI(foundProject.id, aiPendingAction.data.title, aiPendingAction.data.description);
          closeAIActionModal();
          appendAIMessage("assistant", "Đã tạo công việc: " + aiPendingAction.data.title);
          showToast("Đã tạo công việc thành công!");
        } else {
          showToast("Không tìm thấy dự án '" + aiPendingAction.data.projectTitle + "'!");
          closeAIActionModal();
        }
      });
    } else {
      createTaskFromAI(aiPendingAction.data.projectId, aiPendingAction.data.title, aiPendingAction.data.description);
      closeAIActionModal();
      appendAIMessage("assistant", "Đã tạo công việc: " + aiPendingAction.data.title);
      showToast("Đã tạo công việc thành công!");
    }
  }
}

function createQuickNoteFromAI(content) {
  const key = getQuickNoteStorageKey();
  let notes = JSON.parse(localStorage.getItem(key) || "[]");
  
  notes.unshift({
    id: generateId(),
    text: content,
    done: false,
    createdAt: Date.now()
  });
  
  localStorage.setItem(key, JSON.stringify(notes));
  quickNotesCache = notes;
  
  if (firebaseReady && firebaseQuickNotesRef) {
    firebaseQuickNotesRef.set(notes);
  }
  
  renderQuickNotes();
}

function showNoteConfirmation(noteContent) {
  aiPendingAction = { type: "create_note", data: noteContent };

  const title = document.getElementById("aiActionTitle");
  const message = document.getElementById("aiActionMessage");
  const preview = document.getElementById("aiActionPreview");

  title.textContent = "Xác nhận tạo ghi chú";
  message.textContent = "Trợ lý AI muốn tạo ghi chú sau:";
  preview.innerHTML = "<div style='padding: 10px; background: #f5f5f5; border-radius: 8px;'>" + escapeHtml(noteContent) + "</div>";

  document.getElementById("aiActionModal").style.display = "flex";
}

function showProjectConfirmation(title, description) {
  aiPendingAction = { type: "create_project", data: { title, description } };

  const titleEl = document.getElementById("aiActionTitle");
  const message = document.getElementById("aiActionMessage");
  const preview = document.getElementById("aiActionPreview");

  titleEl.textContent = "Xác nhận tạo dự án";
  message.textContent = "Trợ lý AI muốn tạo dự án sau:";
  preview.innerHTML = "<strong>Tên dự án:</strong> " + escapeHtml(title) + "<br><strong>Mô tả:</strong> " + escapeHtml(description || "Không có");

  document.getElementById("aiActionModal").style.display = "flex";
}

function showTaskConfirmation(projectTitle, taskTitle, taskDescription) {
  // Show loading state first
  aiPendingAction = { 
    type: "create_task", 
    data: { 
      projectTitle: projectTitle,
      title: taskTitle, 
      description: taskDescription,
      projectId: null // Will be resolved in confirmAIAction
    } 
  };

  const titleEl = document.getElementById("aiActionTitle");
  const message = document.getElementById("aiActionMessage");
  const preview = document.getElementById("aiActionPreview");

  titleEl.textContent = "Đang tìm dự án...";
  message.textContent = "Vui lòng đợi...";
  preview.innerHTML = "<em>Đang tìm dự án '" + escapeHtml(projectTitle) + "'...</em>";

  document.getElementById("aiActionModal").style.display = "flex";

  // Find project asynchronously
  findProjectByTitle(projectTitle).then(foundProject => {
    const foundProjectId = foundProject ? foundProject.id : null;
    const foundProjectName = foundProject ? foundProject.title : projectTitle;

    // Update pending action with found projectId
    aiPendingAction.data.projectId = foundProjectId;
    aiPendingAction.data.projectTitle = foundProjectName;

    titleEl.textContent = "Xác nhận tạo công việc";
    if (foundProjectId) {
      message.textContent = "Trợ lý AI muốn tạo công việc trong dự án: " + escapeHtml(foundProjectName);
    } else {
      message.textContent = "Trợ lý AI muốn tạo công việc (Dự án '" + escapeHtml(projectTitle) + "' không tìm thấy!)";
    }
    preview.innerHTML = "<strong>Công việc:</strong> " + escapeHtml(taskTitle) + "<br><strong>Mô tả:</strong> " + escapeHtml(taskDescription || "Không có");
  });
}

async function findProjectByTitle(searchTitle) {
  if (!firebaseProjectsRef) return null;
  
  try {
    const snapshot = await firebaseProjectsRef.once("value");
    const projects = snapshot.val() || {};
    
    for (const [id, project] of Object.entries(projects)) {
      if (project.title && project.title.toLowerCase().includes(searchTitle.toLowerCase())) {
        return { id, ...project };
      }
    }
  } catch (e) {
    console.error("Error finding project:", e);
  }
  return null;
}

function createProjectFromAI(title, description) {
  // Open project form modal
  openProjectFormModal(false);
  
  // Fill in the form
  setTimeout(() => {
    const nameInput = document.getElementById("projectFormName");
    const descInput = document.getElementById("projectFormDesc");
    
    if (nameInput) nameInput.value = title;
    if (descInput) descInput.value = description || "";
    
    // Auto submit
    if (nameInput && title) {
      handleProjectFormSubmit({ preventDefault: () => {} });
    }
  }, 100);
}

function createTaskFromAI(projectId, title, description) {
  if (!projectId) {
    showToast("Không tìm thấy dự án!");
    return;
  }

  // Open task form modal
  openTaskFormModal(false, projectId);
  
  // Fill in the form
  setTimeout(() => {
    const nameInput = document.getElementById("taskFormName");
    const descInput = document.getElementById("taskFormDesc");
    
    if (nameInput) nameInput.value = title;
    if (descInput) descInput.value = description || "";
    
    // Auto submit
    if (nameInput && title) {
      handleTaskFormSubmit({ preventDefault: () => {} });
    }
  }, 100);
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

function promptAIKeyPassword() {
  const password = prompt("Nhập mật khẩu để truy cập cài đặt API Key:");
  if (password === "123123") {
    openAIKeyModal();
  } else if (password !== null) {
    alert("Mật khẩu không đúng!");
  }
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
