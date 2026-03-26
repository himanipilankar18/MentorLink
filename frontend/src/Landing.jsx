import { useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Landing() {
  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('mentorlink_token')
    if (token) {
      // Redirect to home page if already authenticated
      window.location.href = `${API_BASE}/home.html`
    }
  }, [])

  return (
    <div className="landing-purple">
      {/* Animated background elements */}
      <div className="bg-gradient"></div>
      <div className="grid-pattern"></div>
      <div className="gradient-orb orb-1"></div>
      <div className="gradient-orb orb-2"></div>
      <div className="gradient-orb orb-3"></div>
      
      <div className="landing-container">
        {/* Header */}
        <header className="header">
          <div className="logo-text">MentorLink</div>
          <nav className="nav-right">
            <a href="#home" className="nav-link">Home</a>
            <a href={`${API_BASE}/login.html`} className="nav-link">Login</a>
            <a href={`${API_BASE}/register.html`} className="nav-link-signup">Sign up</a>
          </nav>
        </header>

        {/* Hero */}
        <section className="hero-center">
          <h1>
            Connect, Grow, Thrive
            <span className="sub">MentorLink</span>
          </h1>
          <p>
            Real connections. Real growth. Join the community where mentorship transforms futures.
          </p>
          <a href={`${API_BASE}/login.html`} className="btn-get-started">
            Get Started
          </a>
        </section>

        {/* Moving feature boxes */}
        <div className="moving-features">
          <div className="features-track">
            <div className="feature-box">Decision-Ready Profiles</div>
            <div className="feature-box">Connect with Mentors</div>
            <div className="feature-box">Intent-Based Discovery</div>
            <div className="feature-box">Build Network</div>
            <div className="feature-box">Share Knowledge</div>
            <div className="feature-box">Decision-Ready Profiles</div>
            <div className="feature-box">Connect with Mentors</div>
            <div className="feature-box">Intent-Based Discovery</div>
            <div className="feature-box">Build Network</div>
            <div className="feature-box">Share Knowledge</div>
          </div>
        </div>
      </div>
    </div>
  )
}
