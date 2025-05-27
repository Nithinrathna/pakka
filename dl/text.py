from flask import Flask, request, jsonify
import google.generativeai as genai
import json
import time
import re
from datetime import datetime, timedelta
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure your Gemini API Key
genai.configure(api_key="AIzaSyALPDtI5Ru0hLlCKuVFyq9hthbw0L5Ekf8")

# Store chat messages with timestamps
chat_messages = [
    {
        "sender": "ai",
        "content": "Hello! I'm InterviewAI. Enter your prompt here to get help with interview preparation, resume tips, or career advice.",
        "timestamp": datetime.now().isoformat()
    }
]

# Model caching
model_cache = {"name": None, "timestamp": None}

# Rate limit tracking
rate_limit_info = {
    "retry_until": datetime.now(),
    "consecutive_failures": 0,
    "backoff_factor": 1.5  # Exponential backoff factor
}

def get_available_model():
    # Check if model is cached and cache is fresh (less than 15 minutes old)
    if (model_cache["name"] and model_cache["timestamp"] and 
        (datetime.now() - model_cache["timestamp"]).total_seconds() < 900):
        return model_cache["name"]
    
    try:
        models = genai.list_models()
        for model in models:
            name = model.name
            methods = model.supported_generation_methods
            if "generateContent" in methods:
                if "gemini-1.5-flash" in name:  # Prefer faster model
                    model_cache["name"] = name
                    model_cache["timestamp"] = datetime.now()
                    return name
                elif "gemini-1.0-pro-vision-latest" in name or "gemini-pro-vision" in name:
                    continue
                model_cache["name"] = name
                model_cache["timestamp"] = datetime.now()
                return name
        return None
    except Exception as e:
        print(f"Error fetching models: {e}")
        return model_cache.get("name")  # Return cached model if available

model_name = get_available_model()

# Pre-compute common fallback responses
FALLBACK_INTERVIEW = """I'm currently experiencing high demand. Here are some general interview tips:

1) Research the company beforehand
2) Prepare examples of your achievements
3) Use the STAR method for behavioral questions
4) Have questions ready for the interviewer"""
    
FALLBACK_RESUME = """While I'm experiencing high demand, here's some resume advice:

1) Tailor your resume to each job
2) Quantify your achievements
3) Keep it concise and error-free
4) Include relevant keywords from the job description"""
    
FALLBACK_SALARY = """I'm currently at capacity, but here's negotiation advice:

1) Research industry standards
2) Highlight your value
3) Consider the entire compensation package
4) Be professional throughout the negotiation process"""
    
FALLBACK_GENERAL = """I'm currently experiencing high demand. Please try again later or check out career resources 
like Indeed, LinkedIn Learning, or Glassdoor for immediate assistance with your question."""

# System instruction - defined once to avoid repetition
SYSTEM_INSTRUCTION = """
You are InterviewAI, a specialized assistant focused on helping users with job interviews, 
resume preparation, and career advice. Provide concise, helpful responses related to:
- Interview preparation and common questions
- Resume writing tips and optimization
- Career advice and job search strategies
- Professional skill development

When listing multiple items, questions, or points:
1. Use proper markdown formatting with line breaks between items
2. Number each item clearly (1., 2., 3., etc.)
3. For interview questions, place each question on a new line
4. Use blank lines between sections for clarity

Always be supportive, practical, and focus on actionable advice.
"""

def extract_retry_seconds(error_message):
    """Extract retry seconds from error message using regex pattern"""
    try:
        # Look for retry_delay section with seconds
        match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+)', error_message)
        if match:
            return int(match.group(1))
        
        # Alternative format
        match = re.search(r'Please retry after (\d+) seconds', error_message)
        if match:
            return int(match.group(1))
            
        return 30  # Default if no specific time found
    except:
        return 30  # Default fallback

def fetch_response(prompt, model_name, max_retries=5):  # Increased max_retries
    global rate_limit_info
    
    # Check if we need to wait due to previous rate limiting
    wait_until = rate_limit_info["retry_until"]
    if datetime.now() < wait_until:
        wait_seconds = (wait_until - datetime.now()).total_seconds()
        if wait_seconds > 5:  # Only wait if it's more than 5 seconds
            print(f"Waiting for rate limit cooldown: {wait_seconds:.1f} seconds remaining")
            # If it's a very long wait (more than 60 seconds), use fallback
            if wait_seconds > 60:
                return get_fallback_response(prompt)
            time.sleep(wait_seconds)
    
    retries = 0
    base_wait_time = 2  # Starting base wait time in seconds
    
    while retries <= max_retries:
        try:
            # Dynamic wait time based on consecutive failures
            if rate_limit_info["consecutive_failures"] > 0:
                dynamic_wait = min(30, base_wait_time * (rate_limit_info["backoff_factor"] ** (rate_limit_info["consecutive_failures"] - 1)))
                print(f"Using dynamic wait time: {dynamic_wait:.1f}s based on {rate_limit_info['consecutive_failures']} failures")
                time.sleep(dynamic_wait)
            
            model = genai.GenerativeModel(model_name)
            
            # Create a chat session with the system instruction
            chat = model.start_chat(history=[])
            chat.send_message(SYSTEM_INSTRUCTION)
            
            # If the prompt is asking for questions, add formatting instructions
            if any(word in prompt.lower() for word in ["questions", "question", "ask", "common questions"]):
                prompt += "\n\nPlease format each question on a separate line with proper numbering."
            
            # Send the user's prompt and get response
            response = chat.send_message(prompt)
            
            # Success! Reset the consecutive failures counter
            rate_limit_info["consecutive_failures"] = 0
            
            # Post-process to ensure proper formatting
            response_text = response.text
            
            # Use regex for more robust formatting of numbered lists
            if re.search(r'\d+\.', response_text) and not re.search(r'\n\d+\.', response_text):
                response_text = re.sub(r'(\S)(\s*)(\d+\.)', r'\1\n\n\3', response_text)
            
            return response_text
            
        except Exception as e:
            error_message = str(e)
            print(f"Error generating content: {error_message}")
            
            # Check if it's a rate limit error
            if "429" in error_message and ("quota exceeded" in error_message.lower() or "rate limit" in error_message.lower()):
                # Increment consecutive failures for exponential backoff
                rate_limit_info["consecutive_failures"] += 1
                
                if retries < max_retries:
                    # Extract retry seconds from error message
                    retry_seconds = extract_retry_seconds(error_message)
                    
                    # Use exponential backoff with jitter for more reliable retry
                    jitter = 0.2 * retry_seconds * (0.5 + 0.5 * (hash(str(datetime.now())) % 100) / 100)
                    wait_time = retry_seconds + jitter
                    
                    print(f"Rate limit hit ({rate_limit_info['consecutive_failures']} consecutive). Retrying in {wait_time:.1f} seconds...")
                    
                    # Update the global retry_until time
                    rate_limit_info["retry_until"] = datetime.now() + timedelta(seconds=wait_time)
                    
                    time.sleep(wait_time)
                    retries += 1
                    continue
                else:
                    # If we've reached max retries, use a fallback response
                    print(f"Max retries ({max_retries}) reached, using fallback response")
                    return get_fallback_response(prompt)
            else:
                # For other errors, return a generic message after one retry
                if retries < 1:  # Try one more time for non-rate-limit errors
                    time.sleep(1)
                    retries += 1
                    continue
                return "Sorry, I encountered an error. Please try again later."
        
    # Fallback if we somehow exit the loop without returning
    return get_fallback_response(prompt)

def get_fallback_response(prompt):
    """Generate a fallback response when the AI service is unavailable"""
    # Check for common interview-related keywords
    prompt_lower = prompt.lower()
    
    if any(word in prompt_lower for word in ["interview", "job", "question", "behavioral"]):
        return FALLBACK_INTERVIEW
    
    elif any(word in prompt_lower for word in ["resume", "cv", "application"]):
        return FALLBACK_RESUME
    
    elif any(word in prompt_lower for word in ["salary", "negotiate", "offer"]):
        return FALLBACK_SALARY
    
    else:
        return FALLBACK_GENERAL

@app.route('/api/chat', methods=['POST'])
def chat():
    start_time = time.time()
    data = request.json
    user_message = data.get("message", "")
    
    if not user_message:
        return jsonify({"error": "Message is required."}), 400

    if not model_name:
        return jsonify({"error": "No model available."}), 500

    # Get AI response with retry logic
    ai_response = fetch_response(user_message, model_name)
    
    # Create timestamp - this will be the same for storage and response
    timestamp = datetime.now().isoformat()
    
    # Add user message and AI response to chat history
    new_messages = [
        {"sender": "user", "content": user_message, "timestamp": timestamp},
        {"sender": "ai", "content": ai_response, "timestamp": timestamp}
    ]
    
    # Update global chat messages
    global chat_messages
    chat_messages.extend(new_messages)
    
    # Keep only the last 50 messages to prevent memory issues
    if len(chat_messages) > 50:
        chat_messages = chat_messages[-50:]
    
    # Log response time
    print(f"Total response time: {time.time() - start_time:.2f} seconds")
    
    # Return just what the frontend needs
    return jsonify({
        "ai_response": ai_response
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "rate_limit_status": {
            "consecutive_failures": rate_limit_info["consecutive_failures"],
            "retry_after": rate_limit_info["retry_until"].isoformat() if datetime.now() < rate_limit_info["retry_until"] else None
        }
    })

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    return jsonify({
        "messages": chat_messages
    })

@app.route('/api/chat/clear', methods=['POST'])
def clear_chat():
    global chat_messages
    chat_messages = [
        {
            "sender": "ai",
            "content": "Hello! I'm InterviewAI. Enter your prompt here to get help with interview preparation, resume tips, or career advice.",
            "timestamp": datetime.now().isoformat()
        }
    ]
    return jsonify({
        "message": "Chat history cleared"
    })

if __name__ == '__main__':
    app.run(port=5006, debug=True)