from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import anthropic
import json
import re

app = FastAPI(title="AI Interview Preparation Assistant", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic()  # Uses ANTHROPIC_API_KEY from env

# ─── Request / Response Models ────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    interview_type: str          # "technical" | "hr" | "system_design"
    role: str                    # e.g. "Software Engineer", "Data Scientist"
    difficulty: str = "medium"   # "easy" | "medium" | "hard"
    candidate_name: Optional[str] = "Candidate"

class AnswerRequest(BaseModel):
    session_id: str
    question: str
    answer: str
    interview_type: str
    difficulty: str
    role: str
    question_number: int

class FeedbackRequest(BaseModel):
    session_id: str
    interview_type: str
    role: str
    qa_history: list  # [{"question": ..., "answer": ..., "score": ...}]

class QuestionRequest(BaseModel):
    interview_type: str
    role: str
    difficulty: str
    previous_questions: list = []
    performance_score: float = 5.0   # used for difficulty progression


# ─── Helper: call Claude ──────────────────────────────────────────────────────

def call_claude(system_prompt: str, user_message: str, max_tokens: int = 1500) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return message.content[0].text


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "AI Interview Preparation Assistant API",
        "version": "1.0.0",
        "endpoints": [
            "POST /start-session",
            "POST /get-question",
            "POST /evaluate-answer",
            "POST /final-feedback",
            "GET  /interview-types",
        ],
    }


@app.get("/interview-types")
def get_interview_types():
    return {
        "types": [
            {
                "id": "technical",
                "name": "Technical Interview",
                "description": "DSA, coding problems, algorithms, data structures",
                "icon": "💻",
            },
            {
                "id": "hr",
                "name": "HR / Behavioral Interview",
                "description": "Situational, behavioural, culture-fit questions",
                "icon": "🤝",
            },
            {
                "id": "system_design",
                "name": "System Design Interview",
                "description": "Architecture, scalability, distributed systems",
                "icon": "🏗️",
            },
        ],
        "difficulties": ["easy", "medium", "hard"],
    }


@app.post("/start-session")
def start_session(req: StartSessionRequest):
    """Initialise a session and return a welcome message + first question."""
    system_prompt = f"""You are an expert interviewer conducting a {req.interview_type} interview 
for a {req.role} position. You are professional, encouraging, and constructive.
Your goal is to assess the candidate fairly while helping them learn."""

    welcome = call_claude(
        system_prompt,
        f"""Generate a warm, professional welcome message for {req.candidate_name} 
who is about to do a {req.interview_type} interview for a {req.role} role at {req.difficulty} difficulty.
Keep it to 2-3 sentences. Just the welcome text, nothing else.""",
        max_tokens=200,
    )

    import uuid
    session_id = str(uuid.uuid4())[:8]

    return {
        "session_id": session_id,
        "welcome_message": welcome,
        "interview_type": req.interview_type,
        "role": req.role,
        "difficulty": req.difficulty,
    }


@app.post("/get-question")
def get_question(req: QuestionRequest):
    """
    Generate the next interview question.
    Difficulty auto-adjusts based on candidate's running performance_score.
    """
    # Difficulty progression logic
    adjusted_difficulty = req.difficulty
    if req.performance_score >= 8.0 and req.difficulty == "easy":
        adjusted_difficulty = "medium"
    elif req.performance_score >= 8.0 and req.difficulty == "medium":
        adjusted_difficulty = "hard"
    elif req.performance_score <= 3.0 and req.difficulty == "hard":
        adjusted_difficulty = "medium"
    elif req.performance_score <= 3.0 and req.difficulty == "medium":
        adjusted_difficulty = "easy"

    prev_qs_text = (
        "\n".join([f"- {q}" for q in req.previous_questions[-5:]])
        if req.previous_questions
        else "None yet"
    )

    type_guidance = {
        "technical": "DSA, algorithms, coding logic, time/space complexity, data structures",
        "hr": "behavioural STAR-method scenarios, teamwork, conflict resolution, leadership",
        "system_design": "system architecture, scalability, databases, APIs, trade-offs",
    }.get(req.interview_type, "general")

    system_prompt = f"""You are an expert {req.interview_type} interviewer for {req.role} positions.
Generate ONE clear, specific interview question. Focus on: {type_guidance}."""

    question_text = call_claude(
        system_prompt,
        f"""Generate a single {adjusted_difficulty}-difficulty {req.interview_type} interview question 
for a {req.role} role.

Previously asked questions (do NOT repeat these):
{prev_qs_text}

Rules:
- Return ONLY the question text, no numbering or preamble
- Make it specific and realistic
- Difficulty level: {adjusted_difficulty}""",
        max_tokens=300,
    )

    return {
        "question": question_text.strip(),
        "difficulty_used": adjusted_difficulty,
        "difficulty_adjusted": adjusted_difficulty != req.difficulty,
        "adjustment_reason": (
            f"Difficulty {'increased' if adjusted_difficulty > req.difficulty else 'decreased'} based on your performance"
            if adjusted_difficulty != req.difficulty
            else None
        ),
    }


@app.post("/evaluate-answer")
def evaluate_answer(req: AnswerRequest):
    """
    Evaluate a single answer and return:
    - score (1-10)
    - strengths
    - improvements
    - ideal answer hints
    - follow-up question (optional)
    """
    type_criteria = {
        "technical": "correctness, efficiency, edge cases, code quality, explanation clarity",
        "hr": "STAR structure, specificity, self-awareness, positive framing, relevance",
        "system_design": "scalability thinking, trade-off awareness, clarity, completeness, practicality",
    }.get(req.interview_type, "clarity, relevance, depth")

    system_prompt = f"""You are an expert {req.interview_type} interviewer evaluating answers for a {req.role} position.
Provide honest, constructive, detailed feedback. Always respond in valid JSON."""

    evaluation_prompt = f"""Evaluate this interview answer and respond ONLY with a valid JSON object.

Role: {req.role}
Interview Type: {req.interview_type}
Difficulty: {req.difficulty}
Question #{req.question_number}

QUESTION: {req.question}
CANDIDATE ANSWER: {req.answer}

Evaluation criteria: {type_criteria}

Respond with this exact JSON structure:
{{
  "score": <integer 1-10>,
  "verdict": "<one of: Excellent | Good | Average | Needs Improvement>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "ideal_answer_hints": "<2-3 sentence description of what an ideal answer includes>",
  "follow_up_question": "<optional follow-up question if answer was partial, else null>",
  "keywords_missed": ["<important keyword/concept the candidate missed>"],
  "encouragement": "<one short encouraging sentence personalised to their answer>"
}}"""

    raw = call_claude(system_prompt, evaluation_prompt, max_tokens=800)

    try:
        # Strip markdown fences if present
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback graceful response
        result = {
            "score": 5,
            "verdict": "Average",
            "strengths": ["You attempted the question"],
            "improvements": ["Please provide a more detailed answer"],
            "ideal_answer_hints": "A strong answer would cover the core concepts with examples.",
            "follow_up_question": None,
            "keywords_missed": [],
            "encouragement": "Keep going, you're doing well!",
            "raw_feedback": raw,
        }

    return result


@app.post("/final-feedback")
def final_feedback(req: FeedbackRequest):
    """
    Generate a comprehensive end-of-interview report with:
    - overall score
    - performance breakdown by skill areas
    - top strengths
    - priority improvement areas
    - personalised study plan
    - readiness verdict
    """
    if not req.qa_history:
        raise HTTPException(status_code=400, detail="No Q&A history provided")

    qa_summary = "\n\n".join(
        [
            f"Q{i+1}: {item.get('question', '')}\nAnswer: {item.get('answer', '')}\nScore: {item.get('score', 'N/A')}/10"
            for i, item in enumerate(req.qa_history)
        ]
    )

    scores = [item.get("score", 5) for item in req.qa_history if isinstance(item.get("score"), (int, float))]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 5.0

    system_prompt = f"""You are a senior {req.interview_type} interview coach providing a comprehensive 
post-interview performance report. Be specific, actionable, and encouraging. Respond in valid JSON."""

    report_prompt = f"""Generate a comprehensive interview performance report. Respond ONLY with valid JSON.

Role: {req.role}
Interview Type: {req.interview_type}
Average Score: {avg_score}/10
Total Questions: {len(req.qa_history)}

Full Interview Q&A:
{qa_summary}

Respond with this exact JSON:
{{
  "overall_score": {avg_score},
  "grade": "<A+ | A | B+ | B | C+ | C | D>",
  "readiness_verdict": "<one of: Interview Ready | Almost Ready | Needs More Practice | Significant Work Required>",
  "performance_summary": "<3-4 sentence overall narrative summary>",
  "skill_breakdown": {{
    "communication": <score 1-10>,
    "technical_knowledge": <score 1-10>,
    "problem_solving": <score 1-10>,
    "confidence": <score 1-10>
  }},
  "top_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "priority_improvements": ["<area 1>", "<area 2>", "<area 3>"],
  "study_plan": [
    {{"week": 1, "focus": "<topic>", "resources": "<specific books/platforms/topics>"}},
    {{"week": 2, "focus": "<topic>", "resources": "<specific books/platforms/topics>"}},
    {{"week": 3, "focus": "<topic>", "resources": "<specific books/platforms/topics>"}}
  ],
  "motivational_message": "<personalised encouraging closing message 2-3 sentences>"
}}"""

    raw = call_claude(system_prompt, report_prompt, max_tokens=1500)

    try:
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        result = {
            "overall_score": avg_score,
            "grade": "B",
            "readiness_verdict": "Needs More Practice",
            "performance_summary": "You completed the interview. Review the individual question feedback for detailed insights.",
            "skill_breakdown": {"communication": 5, "technical_knowledge": 5, "problem_solving": 5, "confidence": 5},
            "top_strengths": ["Completed all questions", "Showed effort"],
            "priority_improvements": ["Practice more", "Study core concepts"],
            "study_plan": [{"week": 1, "focus": "Core concepts", "resources": "Online resources"}],
            "motivational_message": "Keep practicing and you'll get there!",
            "raw": raw,
        }

    return result
