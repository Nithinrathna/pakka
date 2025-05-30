import React from 'react';

function QuestionsSection({ questionsData }) {
  return (
    <section id="questions-section" className="container mx-auto px-4 py-24">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-4xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Saved Questions
        </h2>

        {questionsData.length > 0 ? (
          <div className="text-left space-y-6 max-w-3xl mx-auto text-gray-300">
            {questionsData.map((doc, index) => (
              <div key={index} className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold text-white mb-4">Resume Text:</h3>
                <p className="text-gray-400">{doc.resume_text}</p>
                <h3 className="text-xl font-semibold text-white mt-6">Generated Questions:</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  {Object.entries(doc.questions).map(([skill, question], idx) => (
                    <li key={idx} className="text-gray-400">
                      <strong>{skill}:</strong> {question}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No questions available yet.</p>
        )}
      </div>
    </section>
  );
}

export default QuestionsSection;