import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import BackgroundVideo from './BackgroundVideo';
import Header from '../components/sections/Header';
import MethodSelection from '../components/sections/MethodSelection';
import QuestionGenerator from './QuestionGenerator';
import QuestionsSection from '../components/sections/QuestionSection';
import FeaturesSection from '../components/sections/FeaturesSection';
import AboutSection from '../components/sections/AboutSection';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('resume');
  const [questionsData, setQuestionsData] = useState([]);
  const [otherQuestionsData, setOtherQuestionsData] = useState([]);

  // Fetch questions from the backend on page load
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // Fetch from backend 1 (port 5001)
        const response1 = await axios.get('https://pakka.onrender.com/get-questions');
        setQuestionsData(response1.data.questions);
        
        // If you also want to fetch from backend 2 (port 5003)
        const response2 = await axios.get('https://pakka.onrender.com/get-questions');
        setOtherQuestionsData(response2.data.questions);
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };
  
    fetchQuestions();
  }, []);
  
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 to-black">
      {/* Background Components */}
      <BackgroundVideo />
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-purple-500/10 animate-gradient"></div>

      {/* Content */}
      <div className="relative z-10">
        <Navbar />

        <main className="container mx-auto px-4 pt-24">
          <Header />
          <MethodSelection activeTab={activeTab} setActiveTab={setActiveTab} />
          <QuestionGenerator mode={activeTab} />
        </main>
      </div>

      <QuestionsSection questionsData={questionsData} />
      <FeaturesSection />
      <AboutSection />
    </div>
  );
}

export default Dashboard;