import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authBearerHeaders } from '../apiHeaders';

const Templates = () => {
    const [templates, setTemplates] = useState([]);
    const navigate = useNavigate();
    const { token } = useAuth();

    useEffect(() => {
        if (!token) {
            setTemplates([]);
            return;
        }
        fetch('/api/v1/workoutSessions/templates', { headers: authBearerHeaders(token) })
            .then((res) => res.json())
            .then((data) => setTemplates(Array.isArray(data) ? data : []))
            .catch((err) => console.error("Template load error:", err));
    }, [token]);

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>Templates</h2>
            <div style={{ display: 'grid', gap: '15px' }}>
                {templates.map(temp => (
                    <div 
                        key={temp.id} 
                        onClick={() => navigate(`/workout/${temp.id}`)}
                        style={templateCardStyle}
                    >
                        <h3 style={{ margin: 0 }}>{temp.name}</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem' }}>Click to start session</p>
                    </div>
                ))}
                
                {/* Empty State */}
                {templates.length === 0 && (
                    <p style={{ color: '#999' }}>No templates saved yet.</p>
                )}
            </div>
        </div>
    );
};

const templateCardStyle = {
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #eee',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    cursor: 'pointer',
    transition: 'transform 0.1s'
};

export default Templates;