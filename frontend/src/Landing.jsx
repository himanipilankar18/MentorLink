const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Landing() {
  return (
    <div className="landing-purple">
      <div className="landing-container">
        {/* Header */}
        <header className="header">
          <div className="logo-box">ML</div>
          <nav className="nav-right">
            <a href="#features">Home</a>
            <a href="#features">Services</a>
            <span className="nav-divider" />
            <a href="#features">Our Team</a>
            <a href="#features">About us</a>
            <div className="hamburger">
              <span />
              <span />
              <span />
            </div>
          </nav>
        </header>

        {/* Hero */}
        <section className="hero-center">
          <h1>
            Engage, Evolve, Excel
            <span className="sub">MentorLink</span>
          </h1>
          <p>
            Crafting mentoring experiences that resonate, inspire, and turn connections into lasting growth.
          </p>
          <a href={`${API_BASE}/login.html`} className="btn-get-started">
            Get Started
          </a>
        </section>

        {/* Main grid with decorative elements */}
        <div className="main-grid">
          {/* Connection/Mentor photo cutouts - top left */}
          <div className="connection-cutouts card-3d">
            <div className="mentor-photos">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" alt="Mentor" />
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face" alt="Mentor" />
              <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face" alt="Mentor" />
            </div>
            <button className="btn-check-reviews">Check reviews</button>
          </div>

          {/* Ovals - top right with 3D */}
          <div className="ovals-decor float-3d">
            <div className="oval oval-1" />
            <div className="oval oval-2" />
          </div>

          {/* Central figure - mentor/student photo cutout */}
          <div className="center-figure">
            <div className="center-image-cutout">
              <div className="cutout-bg" />
              <div className="cutout-image-wrap mentor-cutout">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=450&q=90"
                  alt="Mentor and student connection"
                />
              </div>
            </div>
            <div className="cube-3d cube-1" />
            <div className="cube-3d cube-2" />
            <div className="sphere-3d" />
            <div className="social-float tw">𝕏</div>
            <div className="social-float fb">f</div>
            <div className="social-float ig">📷</div>
          </div>

          {/* Speech bubble - 3D tilted */}
          <div className="speech-bubble tilt-3d">
            <p>Boost your academic growth with verified mentors</p>
          </div>

          {/* Bottom left: info box with connection cutouts inside */}
          <div className="bottom-left-group">
            <div className="info-box-left card-3d">
              <p>From Mentorship to Growth, We Drive Results</p>
              <div className="connection-photos-inline">
                <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face" alt="Connection" />
                <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=face" alt="Connection" />
                <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop&crop=face" alt="Connection" />
              </div>
              <button className="btn-check-reviews-inline">Check reviews</button>
              <div className="mini-chart">
                <svg viewBox="0 0 80 30" fill="none">
                  <path d="M0 25 L10 20 L20 22 L30 12 L40 15 L50 8 L60 10 L70 5 L80 12" stroke="rgba(255,255,255,0.8)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Info box - bottom right 3D */}
          <div className="info-box-right card-3d">
            <div className="icon-wrap">⚙</div>
            <p>Thriving Mentors, Thrilled Students — Our Platform in Action</p>
            <div className="info-stats">
              <span className="stat">500+</span>
              <span className="stat">800+</span>
            </div>
            <p style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '8px' }}>Mentors · Students</p>
          </div>
        </div>
      </div>
    </div>
  )
}
