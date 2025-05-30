import React from 'react';

function FeaturesSection() {
  return (
    <section id="features-section" className="container mx-auto px-4 py-24">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-4xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Features
        </h2>
        <p className="text-lg text-gray-300 leading-relaxed">
          InterviewAI blends modern web technologies and NLP techniques to help users simulate real interview situations.
        </p>

        <div className="text-left space-y-6 max-w-3xl mx-auto text-gray-300">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">🔍 Smart Resume Analysis</h3>
            <p>Upload your resume and let our AI extract skills, education, experience, and relevant keywords to generate customized interview questions.</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-2">🎤 Voice Input Mode</h3>
            <p>Practice explaining your background using voice input. The system analyzes your speech contextually and generates interview-style follow-ups.</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-2">⚙️ Workflow Overview</h3>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li>User selects input mode (resume or speech).</li>
              <li>Resume: Extracted data is parsed using NLP tools.</li>
              <li>Speech: Audio is transcribed and interpreted.</li>
              <li>Relevant interview questions are generated from a custom knowledge base.</li>
              <li>Questions are displayed interactively with pro tips.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-2">🚀 Fast & Interactive</h3>
            <p>Everything runs on a modern, responsive frontend powered by React and Tailwind, delivering quick feedback and an engaging user experience.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;