import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

const ALLOW_REPEAT_TDEE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ALLOW_TDEE_REPEAT === "true";
import { useUnits } from "../contexts/UnitsContext";
// Ensure you have your enhanced photo saved in your assets folder!
import CreatorPhoto from "../assets/creator_photo.png"; 
import Sub5Image from "../assets/sub5.png";
import DashboardInsights from "./DashboardInsights";
import { userAvatarUrl } from "../lib/userAvatar";
import { getChadRank } from "../lib/chadRank";

const Dashboard = () => {
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateExercises, setTemplateExercises] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const navigate = useNavigate();
  const { logout, user, loading: authLoading, token } = useAuth();
  const { units, setUnits, foodUnit, setFoodUnit } = useUnits();

  useEffect(() => {
    if (!authLoading && user && user.username_setup_done === false) {
      navigate("/setup/username", { replace: true });
      return;
    }
    if (!authLoading && user && user.role !== "coach" && user.tdee_onboarding_done === false) {
      navigate("/setup/tdee", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleLogout = () => {
    setSettingsOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!token) {
      setTemplates([]);
      setHistory([]);
      return;
    }
    const headers = authBearerHeaders(token);

    fetch('/api/v1/workoutSessions?is_template=true', { headers })
      .then((res) => res.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]));

    fetch('/api/v1/workoutSessions', { headers })
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]));
  }, [token]);

  const workoutCount = history.length;
  const currentRank = getChadRank(workoutCount);

  const handleOpenPreview = async (template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
    try {
      const res = await fetch(`/api/v1/workoutSessions/${template.id}/exerciseLogs`, {
        headers: authBearerHeaders(token),
      });
      const data = await res.json();
      setTemplateExercises(data);
    } catch (err) {
      console.error("Preview load error:", err);
    }
  };

  return (
    <div style={containerStyle}>
      {/* --- SLEEK HEADER WITH CREATOR PHOTO --- */}
      <header style={{ ...dashboardHeaderStyle, zIndex: settingsOpen ? 200 : 10 }}>
        <div style={headerIdentityRow}>
          {user ? (
            <button
              type="button"
              aria-label="Open profile"
              onClick={() => navigate("/profile")}
              style={headerAvatarBtn}
            >
              <img
                src={userAvatarUrl(user)}
                alt=""
                width={48}
                height={48}
                style={headerProfileImg}
              />
            </button>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={dashboardTitleStyle}>Lean is Law</h1>
          {user && (
            <p style={signedInStyle}>
              {user.first_name} {user.last_name}
            </p>
          )}
          <div style={rankRowStyle}>
            <span style={rankBadgeStyle}>{currentRank}</span>
            <span style={rankSubtextStyle}>
              {workoutCount} workout{workoutCount === 1 ? "" : "s"} logged
            </span>
          </div>
          {(currentRank === "SUBHUMAN" || currentRank === "SUB-5" || currentRank === "LTN") && (
            <div style={{ marginTop: '8px', maxWidth: '90px' }}>
              <img 
                src={Sub5Image} 
                alt="Sub-5 struggle" 
                style={{ width: '100%', height: 'auto' }} 
              />
            </div>
          )}
          </div>
        </div>

        <div style={headerActionsStyle}>
          <button
            type="button"
            aria-label="Open settings menu"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            style={hamburgerBtnStyle}
          >
            <span style={hamburgerBarStyle} />
            <span style={hamburgerBarStyle} />
            <span style={hamburgerBarStyle} />
          </button>
          <div style={logoWrapper} onClick={() => navigate("/about")}>
            <img
              src={CreatorPhoto}
              alt="The Creator"
              style={dashboardLogoStyle}
            />
          </div>
          {settingsOpen && (
            <>
              <div
                role="presentation"
                style={settingsBackdropStyle}
                onClick={() => setSettingsOpen(false)}
              />
              <div style={settingsPanelStyle} role="dialog" aria-label="Settings">
                <p style={settingsPanelTitleStyle}>Settings</p>
                <Link
                  to="/premium-coaching"
                  onClick={() => setSettingsOpen(false)}
                  style={settingsPremiumCoachingRowStyle}
                >
                  <span>Premium coaching</span>
                  <span style={premiumBadgeStyle}>PRO</span>
                </Link>
                {user?.role === "coach" ? (
                  <Link
                    to="/coach"
                    onClick={() => setSettingsOpen(false)}
                    style={settingsCoachLinkStyle}
                  >
                    Coach dashboard
                  </Link>
                ) : null}
                <p style={settingsUnitsLabelStyle}>Units (app-wide)</p>
                <div style={settingsSegmentGroupStyle}>
                  <button
                    type="button"
                    onClick={() => setUnits("metric")}
                    style={units === "metric" ? settingsSegmentActiveStyle : settingsSegmentIdleStyle}
                  >
                    Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnits("imperial")}
                    style={units === "imperial" ? settingsSegmentActiveStyle : settingsSegmentIdleStyle}
                  >
                    Imperial
                  </button>
                </div>
                <p style={settingsUnitsLabelStyle}>Food serving unit</p>
                <div style={settingsSegmentGroupStyle}>
                  <button
                    type="button"
                    onClick={() => setFoodUnit("metric")}
                    style={foodUnit === "metric" ? settingsSegmentActiveStyle : settingsSegmentIdleStyle}
                  >
                    Grams
                  </button>
                  <button
                    type="button"
                    onClick={() => setFoodUnit("imperial")}
                    style={foodUnit === "imperial" ? settingsSegmentActiveStyle : settingsSegmentIdleStyle}
                  >
                    Ounces
                  </button>
                </div>
                <button type="button" style={settingsLogoutItemStyle} onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div style={{ padding: '0 20px' }}>
        <DashboardInsights token={token} />
        <div style={{ margin: '8px 0 25px' }}>
          <Link to="/tdee" style={{ display: 'block', textDecoration: 'none' }}>
            <button type="button" style={{ ...btnStyle, width: '100%', fontWeight: '800' }}>
              TDEE & metabolism
            </button>
          </Link>
          {ALLOW_REPEAT_TDEE && (
            <Link to="/setup/tdee" style={{ display: 'block', textDecoration: 'none', marginTop: '10px' }}>
              <button type="button" style={{ ...btnStyle, width: '100%', fontWeight: '600', fontSize: '0.9rem' }}>
                Redo energy setup (testing)
              </button>
            </Link>
          )}
        </div>

        {/* Templates Section */}
        <section id="dashboard-templates" style={{ marginBottom: '40px' }}>
          <h2 style={sectionHeaderStyle}>My Templates</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {templates.map(temp => (
              <div key={temp.id} onClick={() => handleOpenPreview(temp)} style={cardStyle}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>{temp.name}</h3>
                <span style={{ color: '#007aff', fontSize: '0.8rem', fontWeight: '500' }}>View Details</span>
              </div>
            ))}
          </div>
        </section>

        {/* History Section */}
        <section id="dashboard-history">
          <h2 style={sectionHeaderStyle}>Recent History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map(log => (
              <div key={log.id} style={historyItemStyle}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1rem' }}>
                    {log.name}
                    {log.is_template && (
                      <span style={templateTagStyle}>TEMPLATE</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#8e8e93' }}>{new Date(log.date).toLocaleDateString()}</div>
                </div>
                <button onClick={() => navigate(`/workout/${log.id}`)} style={viewBtnStyle}>View</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <TemplatePreviewModal 
          template={selectedTemplate} 
          exercises={templateExercises} 
          onClose={() => setShowPreview(false)}
          onStart={(id) => navigate(`/workout/${id}`)}
        />
      )}
    </div>
  );
};

// --- MODAL COMPONENT ---
const TemplatePreviewModal = ({ template, exercises, onClose, onStart }) => {
  if (!template) return null;
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007aff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{template.name}</h2>
          <span style={{ color: '#007aff', fontWeight: 'bold', cursor: 'pointer' }}>Edit</span>
        </div>

        <div style={{ marginBottom: '20px', maxHeight: '300px', overflowY: 'auto' }}>
          <p style={{ color: '#8e8e93', fontSize: '0.7rem', letterSpacing: '1px', marginBottom: '10px', fontWeight: '700' }}>EXERCISES</p>
          {exercises.map((ex, i) => (
            <div key={i} style={exerciseRowStyle}>
               <div style={iconBox}>{ex.exerciseName ? ex.exerciseName.charAt(0) : (ex.name ? ex.name.charAt(0) : '?')}</div>
               <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{ex.exerciseName || ex.name || "Unknown"}</div>
                  <div style={{ fontSize: '0.8rem', color: '#8e8e93', textTransform: 'capitalize' }}>{ex.body_part || 'Strength'}</div>
               </div>
            </div>
          ))}
        </div>
        <button onClick={() => onStart(template.id)} style={startButtonStyle}>Start Workout</button>
      </div>
    </div>
  );
};

// --- STYLES ---
const containerStyle = {
    backgroundColor: '#f2f2f7',
    minHeight: '100vh',
    paddingBottom: 'calc(48px + 62px + env(safe-area-inset-bottom, 0px))',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
};

const dashboardHeaderStyle = { 
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
  padding: 'calc(20px + env(safe-area-inset-top, 0px)) 20px 20px', backgroundColor: '#fff', borderBottom: '0.5px solid #d1d1d6',
  position: 'sticky', top: 0, zIndex: 10
};

const headerIdentityRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  flex: 1,
  minWidth: 0,
};

const headerAvatarBtn = {
  padding: 0,
  margin: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
  borderRadius: 12,
  flexShrink: 0,
  lineHeight: 0,
};

const headerProfileImg = {
  borderRadius: 12,
  border: "1px solid #d1d1d6",
  objectFit: "cover",
  display: "block",
};

const dashboardTitleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#000', letterSpacing: '-0.5px' };
const signedInStyle = { margin: '6px 0 0', fontSize: '0.85rem', color: '#8e8e93', fontWeight: '600' };

const rankRowStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' };
const rankBadgeStyle = { padding: '2px 10px', borderRadius: '999px', backgroundColor: '#000', color: '#fff', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '1px' };
const rankSubtextStyle = { fontSize: '0.75rem', color: '#8e8e93', fontWeight: '600' };

const headerActionsStyle = { display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' };
const hamburgerBtnStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '5px',
  width: '40px',
  height: '40px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: '10px',
  padding: '8px',
};
const hamburgerBarStyle = { display: 'block', width: '20px', height: '2px', backgroundColor: '#000', borderRadius: '1px', alignSelf: 'center' };
const settingsBackdropStyle = { position: 'fixed', inset: 0, zIndex: 198, background: 'rgba(0,0,0,0.12)' };
const settingsPanelStyle = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  zIndex: 199,
  backgroundColor: '#fff',
  borderRadius: '14px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  border: '0.5px solid #e5e5ea',
  minWidth: '220px',
  overflow: 'hidden',
};
const settingsPanelTitleStyle = {
  margin: 0,
  padding: '12px 16px 8px',
  fontSize: '0.7rem',
  fontWeight: '800',
  color: '#8e8e93',
  letterSpacing: '1px',
  textTransform: 'uppercase',
};
const settingsPremiumCoachingRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  margin: '0 8px 10px',
  padding: '12px 12px',
  borderRadius: 10,
  backgroundColor: '#f2f2f7',
  textDecoration: 'none',
  color: '#000',
  fontSize: '0.95rem',
  fontWeight: '700',
};
const premiumBadgeStyle = {
  fontSize: '0.65rem',
  fontWeight: '800',
  letterSpacing: '0.5px',
  color: '#fff',
  background: 'linear-gradient(135deg, #ff9500, #ff3b30)',
  padding: '3px 8px',
  borderRadius: 6,
};
const settingsCoachLinkStyle = {
  display: 'block',
  margin: '0 8px 12px',
  padding: '10px 12px',
  borderRadius: 10,
  border: '0.5px solid #e5e5ea',
  textDecoration: 'none',
  color: '#007aff',
  fontSize: '0.9rem',
  fontWeight: '600',
};
const settingsUnitsLabelStyle = {
  margin: 0,
  padding: '0 16px 8px',
  fontSize: '0.85rem',
  fontWeight: '600',
  color: '#3a3a3c',
};
const settingsSegmentGroupStyle = {
  display: 'flex',
  margin: '0 16px 12px',
  borderRadius: 10,
  overflow: 'hidden',
  border: '1px solid #d1d1d6',
  backgroundColor: '#e5e5ea',
};
const settingsSegmentIdleStyle = {
  flex: 1,
  border: 'none',
  padding: '10px 12px',
  fontSize: '0.85rem',
  fontWeight: '600',
  color: '#636366',
  backgroundColor: 'transparent',
  cursor: 'pointer',
};
const settingsSegmentActiveStyle = {
  ...settingsSegmentIdleStyle,
  backgroundColor: '#fff',
  color: '#000',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
const settingsLogoutItemStyle = {
  width: '100%',
  textAlign: 'left',
  padding: '14px 16px',
  border: 'none',
  borderTop: '0.5px solid #f2f2f7',
  background: '#fff',
  fontSize: '1rem',
  fontWeight: '600',
  color: '#007aff',
  cursor: 'pointer',
};

const logoWrapper = { 
  width: '42px', height: '42px', borderRadius: '50%', border: '2px solid #007aff', 
  overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: '#eee'
};

const dashboardLogoStyle = { width: '100%', height: '100%', objectFit: 'cover' };

const btnStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #d1d1d6', backgroundColor: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem' };
const sectionHeaderStyle = { fontSize: '1.1rem', fontWeight: '800', marginBottom: '15px', color: '#000' };
const cardStyle = { padding: '20px', backgroundColor: '#fff', borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const historyItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#fff', borderRadius: '12px', marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' };
const viewBtnStyle = { background: 'none', border: 'none', color: '#007aff', fontWeight: '600', cursor: 'pointer' };
const templateTagStyle = { marginLeft: '8px', fontSize: '0.65rem', color: '#007aff', fontWeight: '800', letterSpacing: '0.5px' };

const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: '#1c1c1e', color: 'white', width: '90%', maxWidth: '400px', borderRadius: '25px', padding: '25px' };
const exerciseRowStyle = { display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '0.5px solid #333' };
const iconBox = { width: '38px', height: '38px', backgroundColor: '#3a3a3c', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#007aff' };
const startButtonStyle = { width: '100%', padding: '16px', borderRadius: '14px', backgroundColor: '#007aff', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1rem', marginTop: '15px', cursor: 'pointer' };

export default Dashboard;