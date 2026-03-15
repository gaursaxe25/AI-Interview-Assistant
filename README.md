# 🤖 AI Interview Preparation Assistant — Backend

A FastAPI backend powered by **Claude AI (Anthropic)** that simulates real interviews, evaluates answers in real-time, and generates personalised improvement plans.

---

## 🚀 Quick Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set your API key
```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
export ANTHROPIC_API_KEY=your_key_here
```

### 3. Run the server
```bash
uvicorn main:app --reload --port 8000
```

### 4. View interactive API docs
```
http://localhost:8000/docs
```

---

## 🧠 How AI is Used

| Feature | AI Role |
|---|---|
| **Question Generation** | Claude generates role-specific, non-repeating interview questions |
| **Answer Evaluation** | Claude scores answers 1–10 with strengths, gaps & ideal answer hints |
| **Difficulty Progression** | Score-based logic auto-adjusts difficulty; Claude generates harder/easier questions |
| **Final Report** | Claude analyses the full interview and creates a personalised 3-week study plan |
| **Follow-up Questions** | Claude generates follow-ups when an answer is incomplete |

---

## 📡 API Endpoints

### `GET /interview-types`
Returns available interview types and difficulties.

---

### `POST /start-session`
Starts a new interview session with a personalised welcome message.

**Request:**
```json
{
  "interview_type": "technical",
  "role": "Software Engineer",
  "difficulty": "medium",
  "candidate_name": "Alice"
}
```

**Response:**
```json
{
  "session_id": "abc12345",
  "welcome_message": "Welcome Alice! Let's get started...",
  "interview_type": "technical",
  "role": "Software Engineer",
  "difficulty": "medium"
}
```

---

### `POST /get-question`
Gets the next interview question. Automatically adjusts difficulty based on performance.

**Request:**
```json
{
  "interview_type": "technical",
  "role": "Software Engineer",
  "difficulty": "medium",
  "previous_questions": ["What is a linked list?"],
  "performance_score": 8.5
}
```

**Response:**
```json
{
  "question": "Explain the time complexity of quicksort and when it degrades to O(n²).",
  "difficulty_used": "hard",
  "difficulty_adjusted": true,
  "adjustment_reason": "Difficulty increased based on your performance"
}
```

---

### `POST /evaluate-answer`
Evaluates a candidate's answer and returns detailed real-time feedback.

**Request:**
```json
{
  "session_id": "abc12345",
  "question": "What is a binary search tree?",
  "answer": "It's a tree where left nodes are smaller and right nodes are larger.",
  "interview_type": "technical",
  "difficulty": "medium",
  "role": "Software Engineer",
  "question_number": 1
}
```

**Response:**
```json
{
  "score": 6,
  "verdict": "Good",
  "strengths": ["Correct core definition", "Clear explanation"],
  "improvements": ["Didn't mention time complexity", "No mention of balancing"],
  "ideal_answer_hints": "A strong answer covers O(log n) search, in-order traversal giving sorted output, and AVL/Red-Black trees for balancing.",
  "follow_up_question": "What happens to search time if a BST becomes unbalanced?",
  "keywords_missed": ["AVL tree", "O(log n)", "in-order traversal"],
  "encouragement": "Great start — you nailed the core concept!"
}
```

---

### `POST /final-feedback`
Generates a full performance report after the interview ends.

**Request:**
```json
{
  "session_id": "abc12345",
  "interview_type": "technical",
  "role": "Software Engineer",
  "qa_history": [
    {"question": "What is a BST?", "answer": "...", "score": 6},
    {"question": "Explain quicksort", "answer": "...", "score": 8}
  ]
}
```

**Response:**
```json
{
  "overall_score": 7.0,
  "grade": "B+",
  "readiness_verdict": "Almost Ready",
  "performance_summary": "You demonstrated strong foundational knowledge...",
  "skill_breakdown": {
    "communication": 8,
    "technical_knowledge": 7,
    "problem_solving": 6,
    "confidence": 7
  },
  "top_strengths": ["Clear communication", "Good DS knowledge", "Structured thinking"],
  "priority_improvements": ["Time complexity analysis", "Edge case handling", "System design basics"],
  "study_plan": [
    {"week": 1, "focus": "Advanced DS", "resources": "LeetCode Medium, CLRS Chapter 12"},
    {"week": 2, "focus": "Algorithm Complexity", "resources": "Big-O Cheatsheet, MIT OCW 6.006"},
    {"week": 3, "focus": "Mock Interviews", "resources": "Pramp, Interviewing.io"}
  ],
  "motivational_message": "You're very close to being interview-ready. Keep grinding!"
}
```

---

## 🔄 Suggested Frontend Flow

```
1. GET  /interview-types         → Show interview type selection UI
2. POST /start-session           → Show welcome screen
3. POST /get-question            → Display question (loop)
4. POST /evaluate-answer         → Show real-time feedback card
5. (Repeat 3-4 for N questions)
6. POST /final-feedback          → Show full report / dashboard
```

---

## 🏗️ Architecture

```
Frontend  ──►  FastAPI Backend  ──►  Anthropic Claude API
                    │
                    ├── /start-session     (Claude: welcome generation)
                    ├── /get-question      (Claude: question generation + difficulty logic)
                    ├── /evaluate-answer   (Claude: scoring + structured JSON feedback)
                    └── /final-feedback    (Claude: comprehensive report + study plan)
```

---

## 💡 Hackathon Highlights (AI Usage)

- **Real AI evaluation** — not rule-based; Claude reads and understands natural language answers
- **Dynamic difficulty** — score tracking + AI generates appropriately harder/easier questions
- **Structured JSON responses** — Claude returns structured data directly parseable by frontend
- **Role-specific context** — every prompt is tailored to the job role and interview type
- **No hardcoded questions** — 100% AI-generated, ensuring variety every session
