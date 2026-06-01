// HealthBar.tsx
import React from 'react';

interface HealthBarProps {
  health: number;
}

const HealthBar: React.FC<HealthBarProps> = ({ health }) => {
  return (
    <div style={{
      width: '100%',
      height: '20px',
      backgroundColor: '#555',
      borderRadius: '5px',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${health}%`,
        height: '100%',
        backgroundColor: 'red',
      }} />
    </div>
  );
};

export default HealthBar;