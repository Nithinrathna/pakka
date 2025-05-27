import React, { useState, useEffect, useRef } from 'react';
import { FileUp, Mic, Loader2, AlertCircle, RefreshCw, Download, MessageSquare } from 'lucide-react';
import axios from 'axios';
import '../App.css'

const QuestionGenerator = ({ mode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]); // Store answers
  const [showAnswers, setShowAnswers] = useState(false); // Toggle for showing answers
  const [loadingAnswers, setLoadingAnswers] = useState(false); // Loading state for answers
  const [skills, setSkills] = useState([]);
  const [transcription, setTranscription] = useState(''); // For speech transcription
  const [isRecording, setIsRecording] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef(null);
  const [backendStatus, setBackendStatus] = useState({
    app: false,
    speech: false
  });

  // Check if backend servers are running
  useEffect(() => {
    const checkServers = async () => {
      try {
        const appStatus = await axios.get('http://localhost:5003/health')
          .then(() => true)
          .catch(() => false);
          
        const speechStatus = await axios.get('http://localhost:5001/health')
          .then(() => true)
          .catch(() => false);
          
        setBackendStatus({ app: appStatus, speech: speechStatus });
        
        if (mode === 'resume' && !appStatus) {
          setError("Resume processing server is not available. Please start the server and try again.");
        } else if (mode === 'voice' && !speechStatus) {
          setError("Voice recording server is not available. Please start the server and try again.");
        }
      } catch (error) {
        console.error("Error checking server status:", error);
      }
    };
    
    checkServers();
  }, [mode]);

  // Clear all outputs when mode changes
  useEffect(() => {
    setQuestions([]);
    setAnswers([]);
    setShowAnswers(false);
    setSkills([]);
    setTranscription('');
    setError('');
    setIsLoading(false);
    setIsRecording(false);
  }, [mode]);

  const handleResumeUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const sendFileToPython = async (file) => {
    if (!backendStatus.app) {
      setError("Resume processing server is not available. Please start the server and try again.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setQuestions([]);
    setAnswers([]);
    setShowAnswers(false);
    setSkills([]);
    setTranscription('');
    setError('');

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5MB limit");
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch("http://localhost:5003/generate-questions", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to process your data");
      }

      if (data?.questions) setQuestions(data.questions);
      if (data?.answers) setAnswers(data.answers); // Store answers if provided
      if (data?.skills) setSkills(data.skills);
    } catch (error) {
      console.error("Error sending data:", error);
      
      // More helpful error messages based on error type
      if (error.message && error.message.includes("Collection objects do not implement truth value testing")) {
        setError("Database error: The server is trying to evaluate a MongoDB collection incorrectly. Please contact the administrator.");
      } else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        setError("Connection failed. Is the resume processing server running?");
      } else if (error.message.includes("MongoDB")) {
        setError("Database connection issue. Please try again later.");
      } else {
        setError(error.message || "Failed to process your data. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file) => {
    setQuestions([]);
    setAnswers([]);
    setShowAnswers(false);
    setSkills([]);
    setTranscription('');
    setError('');
    setIsLoading(true);

    const fileType = file.type;
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    
    if (!allowedTypes.includes(fileType)) {
      setError(`Unsupported file type: ${fileType}. Please upload a PDF, DOCX, or TXT file.`);
      setIsLoading(false);
      return;
    }
    
    sendFileToPython(file);
  };

  const toggleRecording = async () => {
    if (!backendStatus.speech) {
      setError("Voice recording server is not available. Please start the server and try again.");
      return;
    }
    
    if (!isRecording) {
      setQuestions([]);
      setAnswers([]);
      setShowAnswers(false);
      setSkills([]);
      setTranscription('');
      setError('');
      setIsRecording(true);
      setIsLoading(true);
      try {
        const response = await axios.post("http://localhost:5001/start-recording");
        if (response.data) {
          const { text, skills, questions, answers } = response.data;
          setSkills(skills || []);
          setQuestions(questions || []);
          if (answers) setAnswers(answers);  // Store answers right away
          setTranscription(text || '');
        }
      } catch (error) {
        console.error("Error during recording:", error);
        
        // More helpful error messages based on error type
        if (error.response) {
          setError(error.response.data.error || "Failed to process your recording. Please try again.");
        } else if (error.request) {
          setError("Cannot connect to the voice recording server. Is it running?");
        } else {
          setError("Failed to start recording. Please try again.");
        }
      } finally {
        setIsLoading(false);
        setIsRecording(false);
      }
    } else {
      setIsRecording(false);
    }
  };

  // Function to generate answers for existing questions
  const generateAnswers = async () => {
    if (questions.length === 0) return;
    
    // Check if we already have answers
    if (answers.length === questions.length) {
      setShowAnswers(true);
      return;
    }
    
    setLoadingAnswers(true);
    setError('');
    
    try {
      const response = await axios.post("http://localhost:5003/generate-answers", {
        questions: questions,
        skills: skills,
        transcript: transcription || ''
      });
      
      if (response.data?.answers) {
        setAnswers(response.data.answers);
        setShowAnswers(true);
      }
    } catch (error) {
      console.error("Error generating answers:", error);
      setError("Failed to generate answers. Please try again.");
    } finally {
      setLoadingAnswers(false);
    }
  };

  const retryConnection = () => {
    // Check server status again
    const checkServers = async () => {
      try {
        const appStatus = await axios.get('http://localhost:5003/health')
          .then(() => true)
          .catch(() => false);
          
        const speechStatus = await axios.get('http://localhost:5001/health')
          .then(() => true)
          .catch(() => false);
          
        setBackendStatus({ app: appStatus, speech: speechStatus });
        
        if ((mode === 'resume' && appStatus) || (mode === 'voice' && speechStatus)) {
          setError('');
        } else {
          setError(`${mode === 'resume' ? 'Resume processing' : 'Voice recording'} server is still not available.`);
        }
      } catch (error) {
        console.error("Error checking server status:", error);
      }
    };
    
    checkServers();
  };

  const exportQuestions = async () => {
    if (questions.length === 0) return;
    
    setIsExporting(true);
    
    try {
      // Create a timestamp for the filename
      const date = new Date();
      const timestamp = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      
      // Format the data for print
      let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Interview Questions - ${timestamp}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #333;
              line-height: 1.6;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #2952C2;
            }
            .section-title {
              color: #2952C2;
              font-size: 24px;
              font-weight: bold;
              margin-top: 30px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px solid #e1e1e1;
            }
            .question {
              background-color: #f9f9f9;
              padding: 15px 20px;
              margin-bottom: 15px;
              border-radius: 5px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .answer {
              background-color: #f0f7ff;
              padding: 15px 20px;
              margin-top: 5px;
              margin-bottom: 15px;
              border-radius: 5px;
              border-left: 4px solid #2952C2;
            }
            .question-number {
              font-weight: bold;
              color: #2952C2;
              margin-right: 10px;
            }
            .skills-container {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-top: 15px;
            }
            .skill-tag {
              background-color: #e8f5e9;
              color: #388e3c;
              padding: 5px 12px;
              border-radius: 15px;
              font-size: 14px;
              font-weight: 500;
            }
            .transcription {
              background-color: #f0f4f8;
              padding: 20px;
              border-radius: 5px;
              margin-bottom: 25px;
              border-left: 4px solid #2952C2;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              font-size: 12px;
              color: #999;
            }
            @media print {
              body {
                padding: 0;
              }
              .container {
                max-width: 100%;
              }
              .question, .skill-tag, .answer {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Interview Questions</h1>
              <p>Generated on ${date.toLocaleDateString()}</p>
            </div>
      `;
      
      // Add transcription section if available
      if (transcription) {
        printContent += `
            <div class="transcription-section">
              <h2 class="section-title">Your Speech Transcript</h2>
              <div class="transcription">${transcription}</div>
            </div>
        `;
      }
      
      printContent += `
            <div class="questions-section">
              <h2 class="section-title">Questions & Answers</h2>
              ${questions.map((question, index) => `
                <div class="question">
                  <span class="question-number">${index + 1}.</span>
                  ${question}
                </div>
                ${answers[index] ? `
                <div class="answer">
                  <strong>Answer:</strong> ${answers[index]}
                </div>
                ` : ''}
              `).join('')}
            </div>
      `;
      
      if (skills.length > 0) {
        printContent += `
            <div class="skills-section">
              <h2 class="section-title">Skills</h2>
              <div class="skills-container">
                ${skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
              </div>
            </div>
        `;
      }
      
      printContent += `
            <div class="footer">
              <p>Generated by Interview Question Generator - ${timestamp}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Create a new window with the content
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Simulate network delay for a better animation experience
      setTimeout(() => {
        // Trigger print dialog
        printWindow.print();
        
        // Add event listener for when print dialog closes
        printWindow.onafterprint = () => {
          printWindow.close();
          setIsExporting(false);
        };
        
        // Fallback in case onafterprint isn't supported
        setTimeout(() => {
          setIsExporting(false);
        }, 2000);
      }, 800);
      
    } catch (error) {
      console.error("Error exporting questions:", error);
      setError("Failed to export questions. Please try again.");
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Server status indicator */}
      {((mode === 'resume' && !backendStatus.app) || (mode === 'voice' && !backendStatus.speech)) && (
        <div className="bg-yellow-800/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            <span className="text-white">
              {mode === 'resume' 
                ? 'Resume processing server is not running.' 
                : 'Voice recording server is not running.'}
            </span>
          </div>
          <button 
            onClick={retryConnection}
            className="bg-yellow-600/50 hover:bg-yellow-500/50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      <div
        className={`relative bg-white/5 backdrop-blur-md rounded-2xl p-8 mb-12 transition-all duration-300 ${
          dragActive ? 'border-2 border-blue-500 bg-blue-500/10' : 'border-2 border-white/10'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        {mode === 'resume' ? (
          <div className="text-center">
            <label className="block">
              <div className="flex flex-col items-center gap-6 cursor-pointer">
                <div className="relative group">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-75 group-hover:opacity-100 blur transition duration-200"></div>
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                    <FileUp className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div className="text-white">
                  <span className="text-xl font-semibold block mb-2">Upload your resume</span>
                  <p className="text-gray-400">Drag & drop your file here or click to browse</p>
                  <p className="text-sm text-gray-500 mt-2">Supported formats: PDF, DOC, DOCX, TXT (Max 5MB)</p>
                </div>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleResumeUpload}
                disabled={!backendStatus.app}
              />
            </label>
          </div>
        ) : (
          <div className="text-center">
            <button 
              onClick={toggleRecording} 
              className="relative group outline-none"
              disabled={!backendStatus.speech}
            >
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-75 group-hover:opacity-100 blur transition duration-200"></div>
              <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                isRecording ? 'bg-gradient-to-br from-red-600 to-red-800 animate-pulse' : 'bg-gradient-to-br from-purple-600 to-purple-800'
              } ${!backendStatus.speech ? 'opacity-50' : ''}`}>
                <Mic className="w-10 h-10 text-white" />
              </div>
            </button>
            <p className="text-xl font-semibold text-white mt-6">
              {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
            </p>
            <p className="text-gray-400 mt-2">
              Speak clearly about your experience and skills
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex justify-center items-center gap-3 text-white bg-red-800/30 rounded-xl p-6 mb-6">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <span className="text-lg">{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center gap-3 text-white bg-white/5 backdrop-blur-md rounded-xl p-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-lg">
            {mode === 'resume' ? 'Analyzing your resume...' : 'Processing your recording...'}
          </span>
        </div>
      )}

      <div ref={contentRef}>
        {/* Display transcription when available */}
        {transcription && !isLoading && (
          <div className="space-y-6 mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-1 bg-purple-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-white">Your Speech Transcription</h2>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border-l-4 border-purple-500">
              <p className="text-white leading-relaxed">{transcription}</p>
            </div>
          </div>
        )}

        {skills.length > 0 && !isLoading && (
          <div className="space-y-6">
            <div className="p-6 bg-white/5 backdrop-blur-md rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1 bg-green-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-white">Extracted Skills</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {skills.map((skill, index) => (
                  <span
                    key={index}
                    className="bg-green-600/60 text-white px-4 py-2 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {questions.length > 0 && !isLoading && (
          <div className="space-y-6 mt-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-white">Your Interview Questions</h2>
              </div>
              
              <div className="flex gap-4">
                {/* Show Answers Toggle Button */}
                {questions.length > 0 && (
                  <button
                    onClick={() => {
                      if (!showAnswers && answers.length === 0) {
                        generateAnswers();
                      } else {
                        setShowAnswers(!showAnswers);
                      }
                    }}
                    disabled={loadingAnswers}
                    className="group relative overflow-hidden rounded-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-teal-500 opacity-70 group-hover:opacity-100 animate-gradient-x"></div>
                    
                    {/* Button content */}
                    <div className="relative flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-green-600 to-teal-700">
                      {loadingAnswers ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-white" />
                      )}
                      <span className="text-white font-medium">
                        {loadingAnswers 
                          ? 'Generating Answers...' 
                          : showAnswers ? 'Hide Answers' : 'Show Answers'}
                      </span>
                    </div>
                  </button>
                )}
              
                {/* Export Button with PDF Animation */}
                <button
                  onClick={exportQuestions}
                  disabled={isExporting || questions.length === 0}
                  className="group relative overflow-hidden rounded-lg"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-70 group-hover:opacity-100 animate-gradient-x"></div>
                  
                  {/* Paper fold corner animations */}
                  <div className={`absolute top-0 right-0 w-5 h-5 bg-white/30 transition-all duration-300 
                    ${isExporting ? 'scale-150' : 'scale-100 group-hover:scale-125'}`}
                    style={{clipPath: 'polygon(100% 0, 0 0, 100% 100%)'}}></div>
                  
                  <div className={`absolute bottom-0 left-0 w-5 h-5 bg-white/20 transition-all duration-500 
                    ${isExporting ? 'scale-150' : 'scale-0 group-hover:scale-100'}`}
                    style={{clipPath: 'polygon(0 100%, 0 0, 100% 100%)'}}></div>
                  
                  {/* Paper sheets animation */}
                  <div className={`absolute inset-0 bg-blue-600/50 transform transition-transform duration-300 ${isExporting ? '-translate-y-1 translate-x-1' : 'translate-y-0 translate-x-0'}`}></div>
                  <div className={`absolute inset-0 bg-purple-600/50 transform transition-transform duration-500 ${isExporting ? '-translate-y-2 translate-x-2' : 'translate-y-0 translate-x-0'}`}></div>
                  
                  {/* Button content */}
                  <div className="relative flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-blue-600 to-purple-700">
                    <Download 
                      className={`w-5 h-5 text-white ${isExporting ? 'animate-bounce' : 'group-hover:animate-pulse'}`} 
                    />
                    <span className="text-white font-medium">
                      {isExporting ? 'Creating PDF...' : 'Export as PDF'}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {questions.map((question, index) => (
                <div key={index}>
                  <div
                    className="group bg-white/5 backdrop-blur-md rounded-xl p-6 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-blue-400 font-medium">{index + 1}</span>
                      </div>
                      <p className="text-lg text-white leading-relaxed">{question}</p>
                    </div>
                  </div>
                  
                  {/* Answer section - shown when showAnswers is true and answer exists */}
                  {showAnswers && answers[index] && (
                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 mt-2 mb-4 border-l-4 border-green-500 transition-all duration-300">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <MessageSquare className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-green-400 mb-1 font-medium">Answer:</p>
                          <p className="text-white leading-relaxed">{answers[index]}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionGenerator;