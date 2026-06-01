import React from "react";
import { Menu, Settings, Mic, MessageSquare, Users, Hexagon, Image, Phone, Swords, Home, Brain, User, PlusCircle } from "lucide-react";

function QuickAccessCard({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary border border-border hover:border-purple-500/50 transition-colors">
      <div className={color}>{icon}</div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1 ${active ? "text-purple-400" : "text-muted-foreground"}`}>
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

export function MobileHome() {
  return (
    <div className="dark">
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {/* Mobile Frame */}
        <div className="w-full max-w-[390px] h-[844px] bg-background rounded-[40px] border-4 border-zinc-800 overflow-hidden relative shadow-2xl">
          {/* Main Content */}
          <div className="px-5 flex flex-col h-full pt-4">
            {/* Header */}
            <div className="flex items-center justify-between py-3">
              <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Menu className="w-5 h-5 text-foreground" />
              </button>
              <button className="w-10 h-10 rounded-full border-2 border-purple-500 flex items-center justify-center">
                <Settings className="w-5 h-5 text-purple-400" />
              </button>
            </div>

            {/* Greeting */}
            <div className="mt-4">
              <h1 className="text-2xl text-muted-foreground">Good morning,</h1>
              <h2 className="text-4xl font-bold text-purple-400 mt-1">Apex</h2>
              <p className="text-muted-foreground mt-3 text-lg">
                How can I help you<br />dominate your day?
              </p>
            </div>

            {/* Hexagon Logo with Glow */}
            <div className="flex-1 flex items-center justify-center relative max-h-[280px] overflow-visible">
              <div className="relative">
                {/* Contained glow layers */}
                <div className="absolute inset-0 blur-2xl bg-purple-600/40 rounded-full scale-[1.8]" />
                <div className="absolute inset-0 blur-xl bg-violet-500/30 rounded-full scale-[1.5]" />
                <div className="absolute inset-0 blur-lg bg-cyan-500/20 rounded-full scale-[1.2]" />

                {/* Sound waves */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-20 flex items-center justify-center gap-0.5 z-0">
                  {Array.from({ length: 70 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-gradient-to-t from-purple-500/20 via-cyan-400/40 to-purple-500/20 rounded-full animate-wave"
                      style={{
                        height: `${Math.random() * 20 + 4}px`,
                        animationDelay: `${i * 0.025}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Hexagon Container */}
                <div className="relative w-44 h-48 flex items-center justify-center z-10">
                  <svg viewBox="0 0 200 230" className="w-full h-full absolute" style={{ filter: 'drop-shadow(0 0 30px rgba(139, 92, 246, 0.7)) drop-shadow(0 0 60px rgba(124, 58, 237, 0.5))' }}>
                    <defs>
                      <linearGradient id="hexBorderGradient" x1="50%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%"   stopColor="#7DD3FC" />
                        <stop offset="15%"  stopColor="#67E8F9" />
                        <stop offset="35%"  stopColor="#A78BFA" />
                        <stop offset="60%"  stopColor="#8B5CF6" />
                        <stop offset="85%"  stopColor="#7C3AED" />
                        <stop offset="100%" stopColor="#6D28D9" />
                      </linearGradient>
                      <linearGradient id="logoGradient" x1="50%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%"   stopColor="#FFFFFF" />
                        <stop offset="35%"  stopColor="#F5F3FF" />
                        <stop offset="65%"  stopColor="#E9D5FF" />
                        <stop offset="100%" stopColor="#D8B4FE" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M100,8 
                         Q115,8 125,18
                         L175,52
                         Q192,62 192,80
                         L192,150
                         Q192,168 175,178
                         L125,212
                         Q115,222 100,222
                         Q85,222 75,212
                         L25,178
                         Q8,168 8,150
                         L8,80
                         Q8,62 25,52
                         L75,18
                         Q85,8 100,8 Z"
                      fill="rgba(12, 8, 30, 0.9)"
                      stroke="url(#hexBorderGradient)"
                      strokeWidth="3.5"
                    />
                  </svg>

                  {/* Apex Logo */}
                  <svg viewBox="0 0 100 115" className="w-[78px] h-[90px] relative z-10">
                    <defs>
                      <linearGradient id="apexLogoGradient" x1="50%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%"   stopColor="#FFFFFF" />
                        <stop offset="30%"  stopColor="#F5F3FF" />
                        <stop offset="60%"  stopColor="#E9D5FF" />
                        <stop offset="100%" stopColor="#D8B4FE" />
                      </linearGradient>
                    </defs>
                    {/* Left arm */}
                    <path d="M50,3 L48,3 L6,75 L10,85 L26,60 L42,60 L50,48 L50,3 Z" fill="url(#apexLogoGradient)" />
                    {/* Right arm */}
                    <path d="M50,3 L52,3 L94,75 L90,85 L74,60 L58,60 L50,48 L50,3 Z" fill="url(#apexLogoGradient)" />
                    {/* Inner V cutout */}
                    <path d="M50,28 L36,60 L42,60 L50,48 L58,60 L64,60 Z" fill="rgba(12, 8, 30, 0.98)" />
                    {/* 4-pointed diamond */}
                    <path d="M50,62 L58,78 L50,94 L42,78 Z" fill="url(#apexLogoGradient)" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Talk to Apex Button */}
            <button className="w-full py-4 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center gap-3 mb-6 relative z-20">
              <span className="text-foreground font-medium text-lg">Talk to Apex</span>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Mic className="w-5 h-5 text-foreground" />
              </div>
            </button>

            {/* Quick Access */}
            <div className="mb-4">
              <h3 className="text-muted-foreground text-sm mb-3">Quick Access</h3>
              <div className="grid grid-cols-3 gap-3">
                <QuickAccessCard icon={<MessageSquare className="w-6 h-6" />} label="AI Chat"          color="text-purple-400" />
                <QuickAccessCard icon={<Users          className="w-6 h-6" />} label="Direct Messages" color="text-purple-400" />
                <QuickAccessCard icon={<Hexagon        className="w-6 h-6" />} label="Hive Mode"       color="text-cyan-400"   />
                <QuickAccessCard icon={<Image          className="w-6 h-6" />} label="Screenshot AI"   color="text-purple-400" />
                <QuickAccessCard icon={<Phone          className="w-6 h-6" />} label="Voice Chat"      color="text-purple-400" />
                <QuickAccessCard icon={<Swords         className="w-6 h-6" />} label="Battle Mode"     color="text-pink-500"   />
              </div>
            </div>

            {/* Bottom Navigation */}
            <div className="flex items-center justify-around py-4 mt-auto">
              <NavItem icon={<Home      className="w-5 h-5" />} label="Home"     active />
              <NavItem icon={<Brain     className="w-5 h-5" />} label="Builder"  />
              <NavItem icon={<User      className="w-5 h-5" />} label="Identity" />
              <NavItem icon={<PlusCircle className="w-5 h-5" />} label="Apex Orb" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
