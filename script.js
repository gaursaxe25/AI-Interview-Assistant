/**
 * AI Interview Preparation Assistant - Frontend Script
 *
 * How the AI integration works (for hackathon presentation):
 * 1. User types answer and clicks Send
 * 2. We call POST /chat with the message and conversation history
 * 3. Backend sends the data to Gemini AI API
 * 4. AI evaluates the answer, gives score/feedback, and generates next question
 * 5. Response is displayed in the chat
 */

// ============================================
// DOM ELEMENTS
// ============================================
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const startBtn = document.getElementById('start-btn');
const welcomeScreen = document.getElementById('welcome-screen');

// Store conversation history for the AI (needed for context)
let conversationHistory = [];

// ============================================
// HELPER: Add message to chat UI
// ============================================
function addMessage(content, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Format AI response - parse Score, Strength, Weakness, Suggestion for styling
    if (!isUser && content) {
        bubble.innerHTML = formatAIResponse(content);
    } else {
        bubble.textContent = content;
    }

    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Format the AI response to highlight Score, Strength, Weakness, Suggestion
 */
function formatAIResponse(text) {
    return text
        .replace(/Score:\s*(\d+\/10)/gi, '<div class="score">Score: $1</div>')
        .replace(/Strength:\s*(.+?)(?=\n|$)/gi, '<div class="strength"><strong>Strength:</strong> $1</div>')
        .replace(/Weakness:\s*(.+?)(?=\n|$)/gi, '<div class="weakness"><strong>Weakness:</strong> $1</div>')
        .replace(/Suggestion:\s*(.+?)(?=\n|$)/gi, '<div><strong>Suggestion:</strong> $1</div>')
        .replace(/\n/g, '<br>');
}

// ============================================
// HELPER: Show typing indicator
// ============================================
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'message ai';
    typingDiv.innerHTML = `
    <div class="message-bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
}

// ============================================
// API CALL: Send message to backend
// ============================================
/**
 * Sends user message to POST /chat endpoint.
 * Backend forwards to Gemini AI and returns the response.
 */
async function sendToAPI(message) {
    const response = await fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            history: conversationHistory
        })
    });

    const data = await response.json();
    return data;
}

// ============================================
// API CALL: Start interview (get first question)
// ============================================
async function startInterview() {
    showTypingIndicator();

    try {
        const response = await fetch('/api/start');
        const data = await response.json();

        hideTypingIndicator();

        if (data.success) {
            addMessage(data.message, false);
            conversationHistory.push({ role: 'assistant', content: data.message });
            welcomeScreen.style.display = 'none';
            sendBtn.disabled = false;
            messageInput.placeholder = 'Type your answer here...';
        } else {
            addMessage(data.message || 'Could not start interview.', false);
        }
    } catch (err) {
        hideTypingIndicator();
        addMessage('Failed to connect to server. Make sure the backend is running.', false);
        console.error(err);
    }
}

// ============================================
// Handle sending user message
// ============================================
async function handleSend() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Add user message to UI
    addMessage(message, true);
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Add to history
    conversationHistory.push({ role: 'user', content: message });

    // Disable input while waiting
    sendBtn.disabled = true;
    messageInput.disabled = true;

    showTypingIndicator();

    try {
        // Call our backend - which then calls Gemini AI
        const data = await sendToAPI(message);

        hideTypingIndicator();

        if (data.success) {
            addMessage(data.message, false);
            conversationHistory.push({ role: 'assistant', content: data.message });
        } else {
            addMessage(data.message || 'Something went wrong. Please try again.', false);
        }
    } catch (err) {
        hideTypingIndicator();
        addMessage('Failed to get response. Check if the server is running.', false);
        console.error(err);
    }

    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
}

// ============================================
// EVENT LISTENERS
// ============================================
startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Starting...';
    startInterview();
});

sendBtn.addEventListener('click', handleSend);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
});
