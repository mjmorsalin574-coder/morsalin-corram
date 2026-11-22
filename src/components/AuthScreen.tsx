import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  createPasswordCredential,
  saveAuthCredential,
  verifyPasswordCredential,
  type AuthCredentialRecord,
} from '../storage/auth';

const BENGALI_WELCOME_TEXT =
  'আমার এই গেমে আপনাদের স্বাগতম আশা করি এই গেমটি খেলে আপনারা আনন্দিত হবেন ধন্যবাদ';

interface AuthScreenProps {
  existingCredential: AuthCredentialRecord | null;
  onAuthenticated: (credential: AuthCredentialRecord) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  existingCredential,
  onAuthenticated,
}) => {
  const isCreateMode = existingCredential === null;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const triggerError = (msg: string) => {
    setSuccessMsg(null);
    setErrorMsg(msg);
    setShakeKey((k) => k + 1);
    soundEngine.playFoul();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || successMsg) return;
    soundEngine.unlock();

    if (!password || password.length === 0) {
      triggerError('অনুগ্রহ করে একটি পাসওয়ার্ড লিখুন।');
      return;
    }

    if (password !== confirmPassword) {
      triggerError('পাসওয়ার্ড দুটি মেলেনি! অনুগ্রহ করে সঠিকভাবে লিখুন।');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const record = await createPasswordCredential(password);
      await saveAuthCredential(record);
      soundEngine.playWin();
      setSuccessMsg('পাসওয়ার্ড সফলভাবে সংরক্ষণ করা হয়েছে! গেমটি চালু হচ্ছে...');
      window.setTimeout(() => {
        onAuthenticated(record);
      }, 650);
    } catch {
      triggerError('পাসওয়ার্ড সংরক্ষণ করা যায়নি! আবার চেষ্টা করুন।');
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !existingCredential) return;
    soundEngine.unlock();

    if (!password || password.length === 0) {
      triggerError('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const valid = await verifyPasswordCredential(password, existingCredential);
      if (valid) {
        soundEngine.playUiTick();
        onAuthenticated(existingCredential);
      } else {
        setBusy(false);
        triggerError('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।');
      }
    } catch {
      setBusy(false);
      triggerError('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।');
    }
  };

  return (
    <div className="liquid-stage relative flex h-full w-full flex-col overflow-y-auto text-[#f4f7ff]">
      {/* Subtle Ambient Light Refraction Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-28 -left-24 h-80 w-80 rounded-full bg-blue-500/20 blur-[96px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-24 -bottom-28 h-80 w-80 rounded-full bg-violet-500/20 blur-[96px]"
      />

      {/* Decorative Local Carrom Board Etched Glass Watermark */}
      <svg
        viewBox="0 0 800 800"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 m-auto h-[min(110vw,110vh)] w-[min(110vw,110vh)] opacity-[0.07]"
      >
        <rect
          x="32"
          y="32"
          width="736"
          height="736"
          rx="52"
          fill="none"
          stroke="#93c5fd"
          strokeWidth="5"
        />
        <rect
          x="68"
          y="68"
          width="664"
          height="664"
          rx="20"
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2.5"
        />
        <circle cx="100" cy="100" r="28" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx="700" cy="100" r="28" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx="100" cy="700" r="28" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx="700" cy="700" r="28" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx="400" cy="400" r="145" fill="none" stroke="#93c5fd" strokeWidth="2.5" />
        <circle cx="400" cy="400" r="90" fill="none" stroke="#c4b5fd" strokeWidth="2" />
        <circle cx="400" cy="400" r="22" fill="#818cf8" />
      </svg>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Top Large Bengali Welcome Liquid Glass Banner */}
        <header className="glass-sheet animate-auth-fade w-full rounded-[28px] px-5 py-5 text-center sm:px-8 sm:py-6">
          <div className="mx-auto mb-3 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-blue-400/80 to-transparent" />
          <h1
            lang="bn"
            className="font-bengali text-xl font-bold leading-[1.7] tracking-normal text-white drop-shadow-[0_2px_14px_rgba(96,165,250,0.35)] sm:text-2xl lg:text-[27px]"
          >
            {BENGALI_WELCOME_TEXT}
          </h1>
          <div className="mx-auto mt-3 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-violet-400/80 to-transparent" />
        </header>

        {/* Liquid Glass Auth Card */}
        <section
          key={shakeKey}
          className={`glass-sheet animate-auth-fade ${
            errorMsg ? 'animate-auth-shake' : ''
          } w-full max-w-md rounded-[30px] p-6 sm:p-7`}
        >
          {/* Carrom Crest Header */}
          <div className="flex flex-col items-center text-center">
            <div className="glass-panel flex h-14 w-14 items-center justify-center rounded-2xl">
              <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
                <circle
                  cx="32"
                  cy="32"
                  r="24"
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke="#93c5fd"
                  strokeWidth="2.5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="15"
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="2"
                />
                <circle cx="32" cy="32" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="font-display mt-3.5 text-xl font-bold tracking-[0.18em] text-white">
              MORSALIN CARROM
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
              {isCreateMode ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                  <span>First-Time Offline Password Setup</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-violet-400" />
                  <span>Returning Player Verification</span>
                </>
              )}
            </p>
          </div>

          {isCreateMode ? (
            <form onSubmit={handleCreateSubmit} className="mt-6 space-y-4">
              {/* 1. Create Password */}
              <div>
                <label
                  htmlFor="create-password"
                  className="block text-xs font-semibold tracking-wide text-slate-200"
                >
                  Create Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="create-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    disabled={busy || !!successMsg}
                    className="glass-input min-h-[48px] w-full rounded-2xl py-2.5 pr-12 pl-4 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTick();
                      setShowPassword((v) => !v);
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-slate-300 transition-colors hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 2. Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-semibold tracking-wide text-slate-200"
                >
                  Confirm Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    disabled={busy || !!successMsg}
                    className="glass-input min-h-[48px] w-full rounded-2xl py-2.5 pr-12 pl-4 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTick();
                      setShowConfirmPassword((v) => !v);
                    }}
                    aria-label={
                      showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                    }
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-slate-300 transition-colors hover:text-white"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  lang="bn"
                  className="font-bengali rounded-2xl border border-red-400/35 bg-red-500/15 px-3.5 py-2.5 text-center text-sm font-medium text-red-100 backdrop-blur-md"
                >
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div
                  role="status"
                  lang="bn"
                  className="font-bengali flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-3.5 py-2.5 text-center text-sm font-medium text-emerald-100 backdrop-blur-md"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* 3. Save Password Button */}
              <button
                type="submit"
                disabled={busy || !!successMsg}
                className="glass-cta flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold tracking-wide disabled:opacity-65"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{busy ? 'Saving...' : 'Save Password'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              {/* 1. Password Input Field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold tracking-wide text-slate-200"
                >
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    disabled={busy}
                    className="glass-input min-h-[48px] w-full rounded-2xl py-2.5 pr-12 pl-4 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTick();
                      setShowPassword((v) => !v);
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-slate-300 transition-colors hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  lang="bn"
                  className="font-bengali rounded-2xl border border-red-400/35 bg-red-500/15 px-3.5 py-2.5 text-center text-sm font-medium text-red-100 backdrop-blur-md"
                >
                  {errorMsg}
                </div>
              )}

              {/* 2. Enter Button */}
              <button
                type="submit"
                disabled={busy}
                className="glass-cta flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold tracking-wide disabled:opacity-65"
              >
                <KeyRound className="h-4 w-4" />
                <span>{busy ? 'Verifying...' : 'Enter'}</span>
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};
