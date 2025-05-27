import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2 } from 'lucide-react';
import './signup.css'

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5004/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName: name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="signup-card">
          <div className="signup-header-wrapper">
            <h2 className="signup-header-title">Create Account</h2>
            <p className="signup-header-subtitle">Join us and start your journey</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="signup-error-wrapper"
            >
              <p className="signup-error-text">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="signup-form-wrapper">
            <div className="signup-form-group">
              <label className="signup-form-label">Name</label>
              <div className="signup-input-wrapper">
                <User className="signup-form-icon" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="signup-form-input"
                  placeholder="Enter your name"
                  required
                />
              </div>
            </div>

            <div className="signup-form-group">
              <label className="signup-form-label">Email</label>
              <div className="signup-input-wrapper">
                <Mail className="signup-form-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="signup-form-input"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="signup-form-group">
              <label className="signup-form-label">Password</label>
              <div className="signup-input-wrapper">
                <Lock className="signup-form-icon" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="signup-form-input"
                  placeholder="Choose a password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="signup-submit-button"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="signup-footer-wrapper">
            Already have an account?{' '}
            <Link to="/login" className="signup-footer-link">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;