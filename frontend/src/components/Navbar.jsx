import React, { useState, useEffect } from 'react';
import { Brain, Home, Lightbulb, Info, User, LogIn, Settings, PenSquare, MessageSquare, HelpCircle, LogOut, Download, Clock, X, Sparkles, MessageCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import '../App.css';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [questionsHistory, setQuestionsHistory] = useState([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      content: "Hello! I'm InterviewAI. Enter your prompt here to get help with interview preparation, resume tips, or career advice.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState({});
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const navigate = useNavigate();

  // Check for user login status on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    if (token && userId) {
      setIsLoggedIn(true);
      fetchUserData(token, userId);
    }
  }, []);

  // Fetch user data from backend using token
  const fetchUserData = async (token, userId) => {
    try {
      setIsLoading(true);
      const response = await fetch(`https://pakka.onrender.com/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const user = await response.json();
        setUserData(user);
        
        // Store user details in localStorage
        if (user.fullName) {
          localStorage.setItem('userName', user.fullName);
        } else if (user.email) {
          const username = user.email.split('@')[0];
          localStorage.setItem('userName', username);
        }
        
        // Store additional user data if needed
        localStorage.setItem('userEmail', user.email);
        if (user.fullName) {
          localStorage.setItem('userFullName', user.fullName);
        }
      } else {
        console.error('Failed to fetch user data:', await response.text());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.error('Network error - server might be down');
        }
      } finally {
        setIsLoading(false);
      }
    };

  const handleAuthError = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    setIsLoggedIn(false);
    setUserData(null);
    setIsAccountMenuOpen(false);
  };

  const handleLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.user._id);
    
    if (data.user.fullName) {
      localStorage.setItem('userName', data.user.fullName);
      localStorage.setItem('userFullName', data.user.fullName);
    } else if (data.user.email) {
      const username = data.user.email.split('@')[0];
      localStorage.setItem('userName', username);
    }
    
    localStorage.setItem('userEmail', data.user.email);
    
    setIsLoggedIn(true);
    setUserData(data.user);
    fetchUserData(data.token, data.user._id);
  };

  const fetchQuestionsHistory = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      let response = await fetch('http://localhost:5003/questions-history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        response = await fetch('https://pakka.onrender.com/questions-history', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch questions history');
        }
      }
      
      const data = await response.json();
      const processedHistory = (data.history || []).map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp).toISOString()
      }));
      
      setQuestionsHistory(processedHistory);
    } catch (error) {
      console.error('Error fetching questions history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavClick = (section) => {
    if (section === 'Home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'About') {
      document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'Features') {
      document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'History') {
      setIsHistoryModalOpen(true);
      fetchQuestionsHistory();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    setIsLoggedIn(false);
    setUserData(null);
    setIsAccountMenuOpen(false);
    navigate('/');
  };

  const toggleExpandEntry = (index) => {
    setExpandedEntries(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Date error";
    }
  };

  const getUserDisplayName = () => {
    if (userData) {
      if (userData.fullName) return userData.fullName;
      if (userData.email) return userData.email.split('@')[0];
    }
    
    const storedFullName = localStorage.getItem('userFullName');
    if (storedFullName) return storedFullName;
    
    const storedUsername = localStorage.getItem('userName');
    if (storedUsername) return storedUsername;
    
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) return storedEmail.split('@')[0];
    
    return 'User';
  };

  const handleExportHistory = () => {
    const dataToExport = selectedHistoryItem !== null
      ? [questionsHistory.find((_, index) => index === selectedHistoryItem)]
      : questionsHistory;
    
    const doc = new jsPDF();
    const primaryColor = [61, 90, 254];
    const secondaryColor = [128, 90, 213];
    const textColor = [50, 50, 50];
    const lightTextColor = [100, 100, 100];
    
    doc.setFillColor(20, 20, 28);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 28, doc.internal.pageSize.getWidth(), 2, 'F');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('InterviewAI Questions', 20, 20);
    
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`Generated on ${currentDate}`, 20, 27);
    
    let yPosition = 50;
    
    dataToExport.forEach((entry, index) => {
      if (yPosition > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(entry.filename || "Speech Interview", 20, yPosition);
      yPosition += 8;
      
      const timestamp = formatTimestamp(entry.timestamp);
      doc.setFontSize(10);
      doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);
      doc.text(`Interview Date: ${timestamp}`, 20, yPosition);
      yPosition += 10;
      
      if (entry.skills && entry.skills.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text("Skills:", 20, yPosition);
        yPosition += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(entry.skills.join(", "), 20, yPosition);
        yPosition += 10;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text("Interview Questions:", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(12);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      
      entry.questions.forEach((question, i) => {
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`${i + 1}. ${question}`, 20, yPosition);
        const lineCount = Math.ceil(question.length / 90);
        yPosition += 7 * lineCount;
      });
      
      if (index < dataToExport.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(20, yPosition, doc.internal.pageSize.getWidth() - 20, yPosition);
        yPosition += 15;
      }
    });
    
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${totalPages} | InterviewAI © ${new Date().getFullYear()}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    doc.save(selectedHistoryItem !== null 
      ? `interview-questions-${new Date().toISOString().slice(0, 10)}.pdf` 
      : `all-interview-questions-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleHistoryItemClick = (index) => {
    setSelectedHistoryItem(index === selectedHistoryItem ? null : index);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (chatMessage.trim() && !isLoadingResponse) {
      try {
        // Add user message to chat
        const userTimestamp = new Date().toISOString();
        const newUserMessage = {
          sender: 'user',
          content: chatMessage,
          timestamp: userTimestamp
        };
        setChatMessages(prev => [...prev, newUserMessage]);
        
        // Clear input
        setChatMessage('');
        setIsLoadingResponse(true);
        
        // Call the backend API
        const response = await fetch('https://pakka.onrender.com/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: chatMessage
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to get response');
        }
        
        const data = await response.json();
        
        // Add AI response to chat using just the ai_response field
        setChatMessages(prev => [
          ...prev,
          {
            sender: 'ai',
            content: data.ai_response,
            timestamp: new Date().toISOString()
          }
        ]);
      } catch (error) {
        console.error('Error fetching AI response:', error);
        setChatMessages(prev => [
          ...prev,
          {
            sender: 'ai',
            content: "Sorry, I encountered an error. Please try again later.",
            timestamp: new Date().toISOString()
          }
        ]);
      } finally {
        setIsLoadingResponse(false);
      }
    }
  };
  const LoadingDots = () => (
    <div className="flex items-center justify-center space-x-1">
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );

  return (
    <>
      <nav className="fixed w-full z-20 top-0">
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-20">
              {/* Logo Section */}
              <div className="flex items-center gap-4 group">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-75 group-hover:opacity-100 blur transition duration-500 animate-spin-slow"></div>
                  <div className="relative p-2 bg-black rounded-full">
                    <Brain className="h-8 w-8 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    InterviewAI
                  </span>
                  <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                </div>
              </div>

              {/* Desktop Navigation */}
              <div className="flex items-center gap-8">
                <NavLink icon={<Home size={18} />} text="Home" onClick={() => handleNavClick('Home')} />
                <NavLink icon={<Lightbulb size={18} />} text="Features" onClick={() => handleNavClick('Features')} />
                <NavLink icon={<Clock size={18} />} text="History" onClick={() => handleNavClick('History')} />
                <NavLink icon={<Info size={18} />} text="About" onClick={() => handleNavClick('About')} />
                
                {/* Chat Button */}
                <button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className="relative group flex items-center gap-2 p-2 rounded-full hover:bg-white/10 transition-all duration-300"
                >
                  <div className="relative">
                    <div className={`absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-75 blur transition-all duration-300 ${isChatOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}></div>
                    <div className="relative">
                      <MessageCircle 
                        size={20} 
                        className={`transition-colors duration-300 ${isChatOpen ? 'text-purple-400' : 'text-gray-400 group-hover:text-white'}`} 
                      />
                    </div>
                  </div>
                  <span className={`transition-colors duration-300 ${isChatOpen ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                    Chat
                  </span>
                  {isChatOpen && (
                    <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></span>
                  )}
                </button>
                
                {/* Account Section */}
                <div className="relative">
                  {isLoggedIn ? (
                    <button
                      onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                      className="flex items-center gap-2 p-2 rounded-full hover:bg-white/10 transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="relative group">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-75 group-hover:opacity-100 blur group-hover:blur-md transition-all duration-300"></div>
                        <div className="relative p-1 bg-black rounded-full">
                          <User size={20} className="text-blue-400 group-hover:text-white transition-colors duration-300" />
                        </div>
                      </div>
                      <span className="text-white font-medium group-hover:text-white">
                        {getUserDisplayName()}
                      </span>
                    </button>
                  ) : (
                    <Link to="/login" className="flex items-center gap-2 p-2 rounded-full hover:bg-white/10 transition-all duration-300">
                      <div className="relative group p-1">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-50 blur transition-all duration-300"></div>
                        <div className="relative">
                          <LogIn size={20} className="text-gray-400 group-hover:text-white transition-colors duration-300" />
                        </div>
                      </div>
                      <span className="text-gray-400 transition-all duration-300 group-hover:text-white">
                        Sign In
                      </span>
                    </Link>
                  )}

                  {/* Account Dropdown */}
                  {isAccountMenuOpen && isLoggedIn && (
                    <div className="absolute right-0 mt-2 w-64 bg-black/95 backdrop-blur-md rounded-lg shadow-lg border border-white/10 py-2 animate-slideIn origin-top-right">
                      <div className="px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="relative group">
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-75 group-hover:opacity-100 blur transition-all duration-300"></div>
                            <div className="relative p-2 bg-black rounded-full">
                              <User size={24} className="text-blue-400" />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">
                              {getUserDisplayName()}
                            </p>
                            <p className="text-xs text-gray-400">
                              {userData ? userData.email : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="py-1">
                        <AccountOption icon={<MessageSquare size={16} />} text="My Interviews" />
                        <AccountOption icon={<PenSquare size={16} />} text="Edit Profile" />
                        <AccountOption icon={<Settings size={16} />} text="Account Settings" />
                        <AccountOption icon={<HelpCircle size={16} />} text="Help Center" />
                        <div className="my-1 border-t border-white/10"></div>
                        <AccountOption 
                          icon={<LogOut size={16} />} 
                          text="Sign Out" 
                          onClick={handleLogout}
                          className="text-red-400 hover:text-red-300" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Chat Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden transform transition-all duration-300 w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-900/30 to-purple-900/30">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <MessageCircle size={24} className="text-blue-400" />
                InterviewAI Chat Assistant
              </h3>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors duration-300"
              >
                <X size={20} className="text-gray-400 hover:text-white" />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-black/20 space-y-4">
              {chatMessages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex items-start gap-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'ai' && (
                    <div className="bg-blue-500/20 p-3 rounded-full flex-shrink-0">
                      <Brain size={20} className="text-blue-400" />
                    </div>
                  )}
                  <div 
                    className={`p-4 rounded-lg max-w-[80%] ${
                      message.sender === 'ai' 
                        ? 'bg-gray-800/50 text-white' 
                        : 'bg-blue-500/20 text-blue-100'
                    }`}
                  >
                    <p className="text-base">{message.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTimestamp(message.timestamp)}
                    </p>
                  </div>
                  {message.sender === 'user' && (
                    <div className="bg-purple-500/20 p-3 rounded-full flex-shrink-0">
                      <User size={20} className="text-purple-400" />
                    </div>
                  )}
                </div>
              ))}
              {isLoadingResponse && (
                <div className="flex items-start gap-4 justify-start">
                  <div className="bg-blue-500/20 p-3 rounded-full flex-shrink-0">
                    <Brain size={20} className="text-blue-400" />
                  </div>
                  <div className="p-4 rounded-lg max-w-[80%] bg-gray-800/50 text-white">
                    <LoadingDots />
                  </div>
                </div>
              )}
            </div>
            
            <form onSubmit={handleChatSubmit} className="p-4 border-t border-white/10 bg-black/30">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Enter your prompt here..."
                  className="flex-1 bg-gray-800/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent text-base"
                  autoFocus
                  disabled={isLoadingResponse}
                />
                <button
                  type="submit"
                  className={`p-3 rounded-lg transition-colors duration-300 border ${
                    isLoadingResponse
                      ? 'bg-gray-700/50 text-gray-500 border-gray-600/30 cursor-not-allowed'
                      : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30'
                  }`}
                  disabled={isLoadingResponse}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1">
                Press Enter to send, Shift+Enter for new line
              </p>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-900 border border-white/10 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                <Clock size={20} className="text-blue-400" />
                Questions History
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportHistory}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors duration-300 border border-blue-500/30"
                  title={selectedHistoryItem !== null ? "Export selected history as PDF" : "Export all history as PDF"}
                >
                  <Download size={16} />
                  <span>Export {selectedHistoryItem !== null ? "Selected" : "All"} as PDF</span>
                </button>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors duration-300"
                >
                  <X size={24} className="text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-75 blur animate-spin-slow"></div>
                    <div className="relative bg-black p-4 rounded-full">
                      <Brain className="h-8 w-8 text-blue-400" />
                    </div>
                  </div>
                  <span className="ml-4 text-gray-300">Loading history...</span>
                </div>
              ) : questionsHistory.length > 0 ? (
                <div className="space-y-6">
                  {questionsHistory.map((entry, index) => (
                    <div 
                      key={index} 
                      className={`border ${selectedHistoryItem === index ? 'border-blue-500' : 'border-white/10'} rounded-lg p-4 hover:bg-white/5 transition-all duration-300 cursor-pointer`}
                      onClick={() => handleHistoryItemClick(index)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-white font-medium text-lg flex items-center gap-2">
                            {entry.filename || "Speech Interview"}
                            {selectedHistoryItem === index && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                Selected
                              </span>
                            )}
                          </h3>
                          <p className="text-gray-400 text-sm flex items-center gap-1">
                            <Clock size={14} />
                            {formatTimestamp(entry.timestamp)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {entry.skills && entry.skills.map((skill, i) => (
                            <span key={i} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-white text-sm font-medium mb-2">Generated Questions:</p>
                        <ul className="space-y-2 text-gray-300 text-sm">
                          {(expandedEntries[index] || selectedHistoryItem === index ? entry.questions : entry.questions.slice(0, 3)).map((question, i) => (
                            <li key={i} className="pl-3 border-l-2 border-purple-500">
                              {question}
                            </li>
                          ))}
                          
                          {entry.questions.length > 3 && selectedHistoryItem !== index && (
                            <li 
                              className="text-purple-400 hover:text-purple-300 cursor-pointer text-sm flex items-center gap-1 pl-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandEntry(index);
                              }}
                            >
                              {expandedEntries[index] ? (
                                <>
                                  <span>Show less</span>
                                  <X size={14} />
                                </>
                              ) : (
                                <>
                                  <span>+{entry.questions.length - 3} more questions</span>
                                </>
                              )}
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="inline-block p-3 rounded-full bg-gray-800 mb-4">
                    <Clock size={32} className="text-gray-400" />
                  </div>
                  <h3 className="text-white text-lg font-medium">No Interview History</h3>
                  <p className="text-gray-400 mt-2 max-w-md mx-auto">
                    Upload a resume or use speech recognition to generate interview questions and they'll appear here.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10 flex justify-end gap-3">
              {selectedHistoryItem !== null && (
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors duration-300"
                >
                  Clear Selection
                </button>
              )}
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const NavLink = ({ icon, text, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 transition-all duration-300 relative group text-gray-400 hover:text-white"
  >
    <span className="relative">{icon}</span>
    <span className="relative">{text}</span>
    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 group-hover:w-full"></span>
  </button>
);

const AccountOption = ({ icon, text, onClick, className = "text-gray-400 hover:text-white", isSpecial, badge }) => (
  <button 
    className={`w-full px-4 py-2 text-sm hover:bg-white/5 text-left flex items-center gap-2 transition-all duration-200 ${
      isSpecial ? "text-gradient bg-gradient-to-r from-blue-400 to-purple-400" : className
    }`}
    onClick={onClick}
  >
    <span className={`${isSpecial ? "text-purple-400" : "opacity-70"}`}>{icon}</span>
    <span>{text}</span>
    {badge && (
      <span className="ml-auto bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-5 text-center">
        {badge}
      </span>
    )}
  </button>
);

export default Navbar;