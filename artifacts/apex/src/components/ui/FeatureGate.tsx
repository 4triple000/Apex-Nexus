/**
 * FeatureGate — Renders children when feature is unlocked,
 * or the ComingSoon overlay when it's gated.
 *
 * Uses the Launch Phase Control System from featureFlags.ts.
 * Admin override: window.setPhase("phase_2")
 */
import type { ReactNode } from 'react';
import { FEATURES, isFeatureEnabled } from '@/lib/featureFlags';
import { ComingSoon } from './ComingSoon';

interface FeatureGateProps {
  /** Key from FEATURES config or FEATURE_ACCESS map */
  feature: string;
  children: ReactNode;
}

export function FeatureGate({ feature, children }: FeatureGateProps) {
  const config = FEATURES[feature];

  // Feature is unlocked for the current launch phase → show it
  if (isFeatureEnabled(feature)) return <>{children}</>;

  // Feature is locked but no ComingSoon config → show nothing
  if (!config) return null;

  // Show coming soon overlay over the blurred page content
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Render actual content blurred behind the overlay */}
      <div style={{
        width:         '100%',
        height:        '100%',
        filter:        'blur(4px) brightness(0.4)',
        transform:     'scale(1.02)',
        overflow:      'hidden',
        pointerEvents: 'none',
        userSelect:    'none',
      }}>
        {children}
      </div>
      <ComingSoon feature={config} />
    </div>
  );
}
