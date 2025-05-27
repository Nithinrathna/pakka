from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests
from dotenv import load_dotenv
import re
from datetime import datetime
from werkzeug.utils import secure_filename

# PDF and DOCX imports with error handling
try:
    from pdfminer.high_level import extract_text as extract_pdf_text
except ImportError:
    print("Warning: pdfminer not installed. PDF extraction will not work.")
    extract_pdf_text = lambda x: "Error: pdfminer not installed"

try:
    from docx import Document
except ImportError:
    print("Warning: python-docx not installed. DOCX extraction will not work.")
    Document = None

# MongoDB with connection error handling
try:
    from pymongo import MongoClient
    mongo_available = True
except ImportError:
    print("Warning: pymongo not installed. Data will not be stored.")
    mongo_available = False

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# API Key setup
api_key = os.getenv("GEMINI_API_KEY", "AIzaSyBXpeJYp7AwLvJ42R2E4Uqz3jfOiTI6Cy0")

# MongoDB setup with error handling
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db = None
collection = None

try:
    if mongo_available:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)  # 5 second timeout
        # Force a connection to verify it works
        client.server_info()
        db = client["geminiquestions"]
        collection = db["questionsset"]
        print("MongoDB connection successful")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    mongo_available = False

# Skill keywords to match - add more industry-relevant skills
skill_keywords = [
    "Python", "Java", "C++", "JavaScript", "React", "Node.js", "TypeScript",
    "SQL", "MongoDB", "AWS", "Docker", "Kubernetes", "Machine Learning", "Angular",
    "Deep Learning", "NLP", "Flask", "Django", "Git", "DevOps", "CI/CD",
    "Vue.js", "GraphQL", "REST API", "Agile", "Scrum", "TDD", "Microservices",
    "Cloud Computing", "Linux", "Shell Scripting", "Data Science", "Big Data",
    "Hadoop", "Spark", "R", "Swift", "Kotlin", "Go", "Ruby", "PHP", "HTML", "CSS",
    "Redux", "SASS", "Webpack", "Jenkins", "Terraform", "Serverless"
]

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    try:
        if ext == ".pdf":
            return extract_pdf_text(filepath)
        elif ext == ".docx":
            if Document is None:
                return "Error: python-docx not installed"
            doc = Document(filepath)
            return "\n".join([p.text for p in doc.paragraphs])
        elif ext == ".txt":
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                return file.read()
        else:
            raise ValueError("Unsupported file type")
    except Exception as e:
        print(f"Error extracting text from {filepath}: {e}")
        return f"Error extracting text: {str(e)}"

def extract_skills_from_text(text):
    """Extract skills from text based on skill_keywords"""
    found_skills = []
    for skill in skill_keywords:
        if re.search(r'\b' + re.escape(skill) + r'\b', text, re.IGNORECASE):
            found_skills.append(skill)
    return found_skills

@app.route('/generate-questions', methods=['POST'])
def generate_questions():
    # Check if file was uploaded
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    
    # Check if file is empty
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    # Check file extension
    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type. Please upload PDF, DOCX, or TXT"}), 400
        
    # Check file size
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)
    
    if file_length > MAX_FILE_SIZE:
        return jsonify({"error": "File size exceeds 5MB limit"}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Extract text from file
        resume_text = extract_text_from_file(filepath)
        
        # Clean up the file after processing
        try:
            os.remove(filepath)
        except Exception as e:
            print(f"Warning: Could not remove file {filepath}: {e}")

        # Validate extracted text
        if resume_text.startswith("Error:"):
            return jsonify({"error": resume_text}), 500
            
        if not resume_text or len(resume_text.strip()) < 50:
            return jsonify({"error": "Could not extract meaningful text from file"}), 400

        # Identify skills
        found_skills = extract_skills_from_text(resume_text)

        # Prompt for Gemini
        prompt = f"""
        Here is a candidate's resume:
        
        {resume_text}
        
        Based on the candidate's skills, experience, and education, generate 20 specific realrime technical interview questions.
        Additionally, provide a suggested answer for each question.
        
        Format your response as follows:
        QUESTIONS:
        1. First question
        2. Second question
        ...
        
        ANSWERS:
        1. Answer to first question
        2. Answer to second question
        ...
        
        Make sure the questions are tailored to the candidate's background and demonstrate their expertise.
        """

        # Call Gemini API
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        data = {"contents": [{"parts": [{"text": prompt}]}]}

        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        result = response.json()

        # Validate Gemini response
        if 'candidates' not in result or not result['candidates']:
            return jsonify({"error": "Invalid response from Gemini API"}), 500

        # Extract and parse questions and answers
        response_text = result['candidates'][0]['content']['parts'][0]['text']
        
        # Parse questions and answers
        questions_section = re.search(r'QUESTIONS:(.*?)(?:ANSWERS:|$)', response_text, re.DOTALL)
        answers_section = re.search(r'ANSWERS:(.*?)$', response_text, re.DOTALL)
        
        questions = []
        answers = []
        
        if questions_section:
            questions_text = questions_section.group(1).strip()
            # Extract questions while removing numbering
            questions = [re.sub(r'^\d+\.\s*', '', q.strip()) 
                        for q in questions_text.split('\n') 
                        if q.strip() and re.match(r'^\d+\.', q.strip())]
                        
        if answers_section:
            answers_text = answers_section.group(1).strip()
            # Extract answers while removing numbering
            answers = [re.sub(r'^\d+\.\s*', '', a.strip()) 
                    for a in answers_text.split('\n') 
                    if a.strip() and re.match(r'^\d+\.', a.strip())]

        # Save to MongoDB if available
        if mongo_available and collection is not None:
            try:
                doc = {
                    "filename": filename,
                    "skills": found_skills,
                    "questions": questions,
                    "answers": answers,
                    "timestamp": datetime.utcnow()
                }
                collection.insert_one(doc)
                print(f"Saved questions and answers to MongoDB for {filename}")
            except Exception as e:
                print(f"Warning: Could not save to MongoDB: {e}")

        return jsonify({
            "skills": found_skills,
            "questions": questions,
            "answers": answers
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Gemini API error: {str(e)}"}), 500
    except Exception as e:
        print(f"Error in generate_questions: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/generate-answers', methods=['POST'])
def generate_answers():
    """Generate answers for existing questions"""
    try:
        data = request.get_json()
        
        if not data or 'questions' not in data:
            return jsonify({"error": "No questions provided"}), 400
            
        questions = data.get('questions', [])
        skills = data.get('skills', [])
        transcript = data.get('transcript', '')
        
        if not questions:
            return jsonify({"error": "No valid questions provided"}), 400
            
        # Format questions for prompt
        questions_formatted = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])
        
        # Create context based on available data
        context = ""
        if skills:
            context += f"Skills: {', '.join(skills)}\n\n"
        if transcript:
            context += f"Interview transcript: {transcript}\n\n"
            
        # Prompt for Gemini
        prompt = f"""
        {context}
        
        For the following interview questions, provide professional and thoughtful answers
        that would demonstrate expertise in the relevant skills and experience:
        
        {questions_formatted}
        
        Format your response as a JSON-compatible list of answers only, with no additional explanation.
        Keep each answer concise but comprehensive, around 3-15 sentences.
        """

        # Call Gemini API
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        data = {"contents": [{"parts": [{"text": prompt}]}]}

        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        result = response.json()

        # Validate Gemini response
        if 'candidates' not in result or not result['candidates']:
            return jsonify({"error": "Invalid response from Gemini API"}), 500

        # Extract answers
        answers_text = result['candidates'][0]['content']['parts'][0]['text']
        
        # Parse answers - try to handle different formats that Gemini might return
        answers = []
        
        # Try to parse as numbered list first
        numbered_answers = re.findall(r'^\d+\.\s*(.*?)(?=^\d+\.|\Z)', answers_text, re.MULTILINE | re.DOTALL)
        if numbered_answers:
            answers = [a.strip() for a in numbered_answers]
        else:
            # If not a numbered list, split by double newlines or try to separate paragraphs
            answers = [a.strip() for a in re.split(r'\n\n+', answers_text) if a.strip()]
            
            # If we still don't have enough answers, try to match with the questions
            if len(answers) != len(questions):
                # Just split into chunks equal to questions
                if answers_text.strip():
                    lines = [line for line in answers_text.split('\n') if line.strip()]
                    chunk_size = max(1, len(lines) // len(questions))
                    answers = []
                    for i in range(0, len(questions)):
                        start_idx = i * chunk_size
                        end_idx = start_idx + chunk_size if i < len(questions) - 1 else len(lines)
                        if start_idx < len(lines):
                            answers.append(' '.join(lines[start_idx:end_idx]))
        
        # Ensure we have an answer for each question
        while len(answers) < len(questions):
            answers.append("I would need more context to provide a comprehensive answer to this question.")
            
        # Trim to match number of questions
        answers = answers[:len(questions)]

        return jsonify({
            "answers": answers
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Gemini API error: {str(e)}"}), 500
    except Exception as e:
        print(f"Error in generate_answers: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    status = {
        "status": "healthy",
        "mongodb_connected": mongo_available,
        "api_key_configured": bool(api_key)
    }
    return jsonify(status), 200

@app.route('/questions-history', methods=['GET'])
def get_questions_history():
    if not mongo_available or collection is None:
        return jsonify({"error": "MongoDB not available"}), 500
        
    try:
        # Fetch questions history from MongoDB
        cursor = collection.find({}, {
            "_id": 0,  # Exclude MongoDB ID
            "filename": 1,
            "skills": 1,
            "questions": 1,
            "answers": 1,
            "timestamp": 1
        }).sort("timestamp", -1).limit(20)  # Get most recent 20 entries
        
        # Convert cursor to list of dictionaries
        history = []
        for doc in cursor:
            # Convert ObjectId and datetime to string for JSON serialization
            if "timestamp" in doc:
                doc["timestamp"] = doc["timestamp"].isoformat()
            history.append(doc)
            
        return jsonify({"history": history})
    except Exception as e:
        print(f"Error fetching questions history: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Flask server on port 5003...")
    app.run(port=5003, debug=True)