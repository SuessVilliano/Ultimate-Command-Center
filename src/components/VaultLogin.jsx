import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Zap,
  Shield,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';

function VaultLogin() {
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [vaultState, setVaultState] = useState('locked'); // locked, unlocking, unlocked
  const [particles, setParticles] = useState([]);

  // Generate floating particles
  useEffect(() => {
    const generateParticles = () => {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 1,
        duration: Math.random() * 20 + 10,
        delay: Math.random() * 5
      }));
      setParticles(newParticles);
    };
    generateParticles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsUnlocking(true);
    setVaultState('unlocking');

    // Simulate vault unlocking animation
    await new Promise(resolve => setTimeout(resolve, 1500));

    const result = login(username, password);

    if (result.success) {
      setVaultState('unlocked');
      await new Promise(resolve => setTimeout(resolve, 800));
    } else {
      setVaultState('locked');
      setError(result.error);
      setIsUnlocking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305] flex items-center justify-center overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-purple-500/20"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `float ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`
            }}
          />
        ))}
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-3xl" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Main vault container */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 mb-4 transition-all duration-500 ${
            vaultState === 'unlocking' ? 'animate-pulse scale-110' : ''
          } ${vaultState === 'unlocked' ? 'scale-125' : ''}`}>
            {vaultState === 'locked' && <Lock className="w-10 h-10 text-white" />}
            {vaultState === 'unlocking' && <Loader2 className="w-10 h-10 text-white animate-spin" />}
            {vaultState === 'unlocked' && <Unlock className="w-10 h-10 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            LIV8 Command Center
          </h1>
          <p className="text-gray-400 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            Secure Access Portal
          </p>
        </div>

        {/* Vault door effect */}
        <div className={`relative transition-all duration-700 ${
          vaultState === 'unlocked' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
          {/* Outer ring */}
          <div className={`absolute -inset-4 rounded-3xl transition-all duration-500 ${
            vaultState === 'unlocking'
              ? 'bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 animate-spin-slow opacity-50'
              : 'bg-gradient-to-br from-purple-900/50 to-cyan-900/50 opacity-30'
          }`} style={{ filter: 'blur(20px)' }} />

          {/* Main card */}
          <div className="relative bg-[#0a0a0f]/90 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl">
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-purple-500/50 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-purple-500/50 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-purple-500/50 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-purple-500/50 rounded-br-2xl" />

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    placeholder="Enter username"
                    required
                    disabled={isUnlocking}
                  />
                  <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/50" />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all pr-12"
                    placeholder="Enter password"
                    required
                    disabled={isUnlocking}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isUnlocking || !username || !password}
                className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-3 ${
                  isUnlocking
                    ? 'bg-purple-600/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 hover:shadow-lg hover:shadow-purple-500/25'
                }`}
              >
                {isUnlocking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Unlocking Vault...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Access Command Center
                  </>
                )}
              </button>
            </form>

            {/* Features preview */}
            <div className="mt-8 pt-6 border-t border-purple-500/20">
              <p className="text-xs text-gray-500 text-center mb-4">COMMAND CENTER FEATURES</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: '📊', label: 'Dashboard' },
                  { icon: '🎫', label: 'Tickets' },
                  { icon: '🤖', label: 'AI Agents' }
                ].map((feature, i) => (
                  <div key={i} className="text-center p-2 rounded-lg bg-white/5 border border-purple-500/10">
                    <div className="text-xl mb-1">{feature.icon}</div>
                    <div className="text-xs text-gray-400">{feature.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          © 2026 LIV8 Command Center • Powered by AI
        </p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default VaultLogin;
