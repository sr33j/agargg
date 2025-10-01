import React, { useState, useEffect } from "react";

interface UsernameFormProps {
  currentUsername?: string;
  onUsernameChange: (username: string) => void;
}

export function UsernameForm({ currentUsername = "", onUsernameChange }: UsernameFormProps) {
  const [username, setUsername] = useState(currentUsername);
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("playerUsername");
    if (stored) {
      setUsername(stored);
      onUsernameChange(stored);
    }
  }, []);

  function handleSave() {
    if (username.trim()) {
      localStorage.setItem("playerUsername", username.trim());
      onUsernameChange(username.trim());
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleCancel() {
    setUsername(currentUsername);
    setIsEditing(false);
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      width: '300px'
    }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Player Name</h3>
      
      {!isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
            {username || "Anonymous"}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #667eea',
              background: 'white',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Edit
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px',
              marginBottom: '12px'
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                background: '#667eea',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
      
      {saved && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: '#d4edda',
          color: '#155724',
          borderRadius: '6px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          Name saved!
        </div>
      )}
    </div>
  );
}