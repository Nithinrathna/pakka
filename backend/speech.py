from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import numpy as np
from datetime import datetime

# === Optional Dependencies ===
try:
    import speech_recognition as sr
    speech_recognition_available = True
except ImportError:
    print("Warning: speech_recognition not installed. Speech recognition will not work.")
    speech_recognition_available = False
    sr = None

try:
    import sounddevice as sd
    sounddevice_available = True
except ImportError:
    print("Warning: sounddevice not installed. Audio recording will not work.")
    sounddevice_available = False
    sd = None

try:
    import nltk
    from nltk.tokenize import word_tokenize
    nltk_available = True
    nltk.download('punkt', quiet=True)
except ImportError:
    print("Warning: nltk not installed. Skill extraction will be limited.")
    nltk_available = False
    word_tokenize = lambda x: x.lower().split()

# === Gemini Setup ===
import google.generativeai as genai
import threading

# Set your Gemini API key securely (e.g., as an environment variable)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBXpeJYp7AwLvJ42R2E4Uqz3jfOiTI6Cy0")  # Replace with actual API key
genai.configure(api_key=GEMINI_API_KEY)

# Cache mechanism for model to avoid repeated initialization
gemini_model = None
model_lock = threading.Lock()

# === Function to list available models ===
def list_available_models():
    try:
        models = genai.list_models()
        print("Available models:")
        for model in models:
            print(f"- {model.name}")
        return models
    except Exception as e:
        print(f"Error listing models: {e}")
        return []

# Initialize Gemini model lazily (only when needed)
def get_gemini_model():
    global gemini_model
    
    if gemini_model is not None:
        return gemini_model
        
    with model_lock:
        if gemini_model is not None:  # Check again in case another thread initialized it
            return gemini_model
            
        # Try different model name formats
        model_options = [
            "gemini-1.5-pro",       # Updated name format
            "gemini-pro",           # Original name
            "models/gemini-pro",    # Full path format
            "gemini-1.0-pro"        # Version-specific format
        ]
        
        # Try each model until one works
        for model_name in model_options:
            try:
                print(f"Trying to initialize model: {model_name}")
                model = genai.GenerativeModel(model_name)
                print(f"Successfully initialized model: {model_name}")
                gemini_model = model
                return model
            except Exception as e:
                print(f"Failed to initialize {model_name}: {e}")
        
        # If no model worked, return None
        return None

# === Flask App Setup ===
app = Flask(__name__)
CORS(app)

# === Skill Keywords List ===
skill_keywords = [
    'python', 'javascript', 'react', 'mongodb', 'nodejs',
    'django', 'html', 'css', 'java', 'sql', 'c++', 'golang',
    'machine learning', 'data science', 'ai', 'cloud', 'aws',
    'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'cicd',
    'agile', 'scrum', 'testing', 'security', 'blockchain'
]

# === Extract Skills from Text ===
def extract_skills(text):
    if not text:
        return []
    tokens = word_tokenize(text.lower()) if nltk_available else text.lower().split()
    
    # Enhanced skill detection - check for multi-word skills
    found_skills = []
    for skill in skill_keywords:
        if ' ' in skill:  # Multi-word skill
            if skill.lower() in text.lower():
                found_skills.append(skill)
        elif skill in tokens:  # Single word skill
            found_skills.append(skill)
    
    return list(set(found_skills))

# === Gemini API Question Generator ===
def get_questions_from_gemini(skills, text=""):
    if not skills and not text:
        return ["Tell me about your technical background."]
    
    model = get_gemini_model()
    if model is None:
        return ["Gemini model not available. Please check your API key and available models."]
    
    # Improved prompt that includes both skills and transcript for better context
    prompt = (
        f"Generate 10 technical interview questions based on the following:\n\n"
        f"Skills mentioned: {', '.join(skills)}\n"
        f"Candidate background: {text}\n\n"
        f"Make questions specific to their experience and skills. Focus on technical depth."
    )
    
    try:
        # Use streaming for more efficient response handling
        response = model.generate_content(prompt, stream=False)
        
        # Process the response to get clean questions
        questions = []
        if response.text:
            # Split by newlines and clean up question formatting
            raw_questions = [q.strip() for q in response.text.strip().split("\n") if q.strip()]
            
            # Clean up question formatting (remove numbers/bullets if present)
            for q in raw_questions:
                # Remove leading numbers, dots, dashes, etc.
                cleaned = q
                if cleaned and any(q.startswith(prefix) for prefix in ["Q", "#", "Question", "1.", "2."]):
                    # Extract just the question part
                    parts = q.split(":", 1)
                    if len(parts) > 1:
                        cleaned = parts[1].strip()
                    else:
                        # Try to remove just the prefix
                        for i, char in enumerate(q):
                            if char.isalpha() and not q[:i].strip("Q#0123456789. "):
                                cleaned = q[i:].strip()
                                break
                
                if cleaned:
                    questions.append(cleaned)
            
            # Ensure we have 10 questions
            if not questions:
                questions = ["Tell me about your experience with " + skill for skill in skills[:5]]
                questions.extend(["What challenges have you faced with " + skill for skill in skills[:5]])
        
        return questions[:10]  # Return max 10 questions
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        return [f"Error generating questions: {str(e)}"]

# === Generate Answers Function ===
def generate_answers(questions, skills=[], transcript=""):
    model = get_gemini_model()
    if model is None:
        return ["Gemini model not available. Please check your API key and available models."]
    
    answers = []
    
    # Build context for generating more accurate answers
    context = f"Skills: {', '.join(skills)}\n\nBackground: {transcript}\n\n"
    
    for question in questions:
        try:
            prompt = (
                f"{context}\n"
                f"Question: {question}\n\n"
                f"Provide a concise, professional answer from the perspective of a job candidate with "
                f"the skills and background mentioned above. Focus on technical accuracy and how you would "
                f"answer in an interview. Keep the answer to 5 sentences."
            )
            
            response = model.generate_content(prompt)
            answer = response.text.strip()
            answers.append(answer)
        except Exception as e:
            print(f"Error generating answer for question: {question}")
            print(f"Error: {e}")
            answers.append("I would approach this by leveraging my technical experience and problem-solving skills.")
    
    return answers

# === Endpoint: Record and Generate Questions ===
@app.route('/start-recording', methods=['POST'])
def start_recording():
    if not speech_recognition_available:
        return jsonify({"error": "Speech recognition module not installed"}), 500
    if not sounddevice_available:
        return jsonify({"error": "Sound device module not installed"}), 500
        
    try:
        # Reduced duration for faster processing
        print("🎙️ Listening for 3 seconds...")
        samplerate = 16000  # Reduced from potential higher values
        duration = 3 # Reduced from 3 seconds
        recording = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype='int16')
        sd.wait()
        audio_data = sr.AudioData(recording.tobytes(), samplerate, 2)

        # Recognize speech using Google's API
        text = sr.Recognizer().recognize_google(audio_data)
        print(f"🗣️ Recognized Text: {text}")

        skills = extract_skills(text)
        print("🧠 Extracted Skills:", skills)

        # Basic fallback detection if no skills are found
        if not skills:
            default_words = ["programming", "developer", "software", "tech", "code", "engineer"]
            if any(word in text.lower() for word in default_words):
                skills = ["python", "javascript"]

        # Generate questions based on skills and transcript
        questions = get_questions_from_gemini(skills, text)
        print("📋 Gemini Questions:", questions)
        
        # Generate answers immediately for the questions
        answers = generate_answers(questions, skills, text)
        print("💬 Generated answers for questions")

        return jsonify({
            "text": text,
            "skills": skills,
            "questions": questions,
            "answers": answers  # Include the answers in the response
        })

    except sr.UnknownValueError:
        return jsonify({'error': "Couldn't understand the audio. Please try again."}), 400
    except sr.RequestError as e:
        return jsonify({'error': f'Speech Recognition API error: {e}'}), 500
    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({'error': f'Unexpected server error: {str(e)}'}), 500

# === Endpoint: Health Check ===
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "speech_recognition_available": speech_recognition_available,
        "sounddevice_available": sounddevice_available,
        "nltk_available": nltk_available,
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "gemini_model_available": get_gemini_model() is not None
    }), 200

# === Endpoint: List Models ===
@app.route('/list-models', methods=['GET'])
def list_models_endpoint():
    try:
        models = list_available_models()
        model_names = [model.name for model in models]
        return jsonify({
            "models": model_names
        }), 200
    except Exception as e:
        return jsonify({
            "error": f"Failed to list models: {str(e)}"
        }), 500

# === Run Flask App ===
if __name__ == '__main__':
    print("🚀 Starting Flask server on port 5001...")
    app.run(debug=True, port=5001)