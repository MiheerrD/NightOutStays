'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function GuestLoginPage() {
  const [mode, setMode] = useState('login');
  const [redirectTo, setRedirectTo] = useState('/account/bookings');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    initialisePage();
  }, []);

  async function initialisePage() {
    try {
      let destination = '/account/bookings';

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const requestedRedirect = params.get('redirect');

        if (
          requestedRedirect &&
          requestedRedirect.startsWith('/') &&
          !requestedRedirect.startsWith('//')
        ) {
          destination = requestedRedirect;
        }
      }

      setRedirectTo(destination);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (session) {
        window.location.replace(destination);
        return;
      }
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error?.message || 'Unable to check login status.'
      );
    } finally {
      setCheckingSession(false);
    }
  }

  function clearMessages() {
    setErrorMessage('');
    setSuccessMessage('');
  }

  function switchMode(nextMode) {
    setMode(nextMode);

    clearMessages();

    setPassword('');
    setConfirmPassword('');
  }

  async function ensureGuestProfile(user, suppliedName = '') {
    if (!user?.id) {
      throw new Error('Guest account information is missing.');
    }

    const normalizedEmail =
      user.email?.trim().toLowerCase() || null;

    const {
      data: existingByUser,
      error: userLookupError,
    } = await supabase
      .from('guests')
      .select('id, user_id, full_name, email, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userLookupError) {
      throw userLookupError;
    }

    if (existingByUser) {
      const updates = {};

      if (!existingByUser.full_name && suppliedName.trim()) {
        updates.full_name = suppliedName.trim();
      }

      if (!existingByUser.email && normalizedEmail) {
        updates.email = normalizedEmail;
      }

      if (Object.keys(updates).length > 0) {
        const {
          data: updatedGuest,
          error: updateError,
        } = await supabase
          .from('guests')
          .update(updates)
          .eq('id', existingByUser.id)
          .select('id, user_id, full_name, email, phone')
          .single();

        if (updateError) throw updateError;

        return updatedGuest;
      }

      return existingByUser;
    }

    /*
      Older NightOutStays guest records may already exist
      with the same email but without user_id.

      Link that existing guest to the authenticated account
      instead of creating a duplicate guest.
    */

    if (normalizedEmail) {
      const {
        data: existingByEmail,
        error: emailLookupError,
      } = await supabase
        .from('guests')
        .select('id, user_id, full_name, email, phone')
        .eq('email', normalizedEmail)
        .is('user_id', null)
        .maybeSingle();

      if (emailLookupError) {
        throw emailLookupError;
      }

      if (existingByEmail) {
        const {
          data: linkedGuest,
          error: linkError,
        } = await supabase
          .from('guests')
          .update({
            user_id: user.id,

            full_name:
              existingByEmail.full_name ||
              suppliedName.trim() ||
              user.user_metadata?.full_name ||
              normalizedEmail.split('@')[0],
          })
          .eq('id', existingByEmail.id)
          .select('id, user_id, full_name, email, phone')
          .single();

        if (linkError) throw linkError;

        return linkedGuest;
      }
    }

    const guestName =
      suppliedName.trim() ||
      user.user_metadata?.full_name ||
      normalizedEmail?.split('@')[0] ||
      'Guest';

    const {
      data: newGuest,
      error: insertError,
    } = await supabase
      .from('guests')
      .insert({
        user_id: user.id,
        full_name: guestName,
        email: normalizedEmail,
        phone: null,
      })
      .select('id, user_id, full_name, email, phone')
      .single();

    if (insertError) throw insertError;

    return newGuest;
  }

  async function handleSignup(event) {
    event.preventDefault();

    clearMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!normalizedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        'Password must be at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,

        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Unable to create your account.');
      }

      /*
        Email confirmation is disabled in Supabase,
        so a successful signup should return a session.
      */

      if (!data.session) {
        throw new Error(
          'Account was created but automatic login was not completed. Please try logging in.'
        );
      }

      await ensureGuestProfile(
        data.user,
        fullName
      );

      window.location.replace(redirectTo);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        friendlyAuthError(
          error,
          'Unable to create account.'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    clearMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage(
        'Please enter your email and password.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (error) throw error;

      if (!data.user || !data.session) {
        throw new Error('Unable to login.');
      }

      const guestName =
        data.user.user_metadata?.full_name ||
        data.user.email?.split('@')[0] ||
        'Guest';

      await ensureGuestProfile(
        data.user,
        guestName
      );

      window.location.replace(redirectTo);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        friendlyAuthError(
          error,
          'Unable to login.'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    clearMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage(
        'Enter your registered email address first.'
      );
      return;
    }

    setLoading(true);

    try {
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://nightoutstay.com';

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: `${origin}/reset-password`,
          }
        );

      if (error) throw error;

      setSuccessMessage(
        'Password recovery email sent. Please check your inbox and open the reset link.'
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          'Unable to send password recovery email.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="loading-page">
        Checking login...
        <PageStyles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <div className="brand">
          NightOutStays
        </div>

        <h1>
          {mode === 'login'
            ? 'Guest Login'
            : 'Create Guest Account'}
        </h1>

        <p className="subtitle">
          {mode === 'login'
            ? 'Login to manage your bookings, messages, payments and stays.'
            : 'Create your account to request bookings and manage your stays.'}
        </p>

        <div className="tabs">
          <button
            type="button"
            className={
              mode === 'login'
                ? 'tab active'
                : 'tab'
            }
            onClick={() =>
              switchMode('login')
            }
          >
            Login
          </button>

          <button
            type="button"
            className={
              mode === 'signup'
                ? 'tab active'
                : 'tab'
            }
            onClick={() =>
              switchMode('signup')
            }
          >
            Sign Up
          </button>
        </div>

        <form
          onSubmit={
            mode === 'login'
              ? handleLogin
              : handleSignup
          }
        >
          {mode === 'signup' && (
            <Field
              label="FULL NAME"
              type="text"
              value={fullName}
              onChange={setFullName}
              placeholder="Your full name"
              autoComplete="name"
            />
          )}

          <Field
            label="EMAIL"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <Field
            label="PASSWORD"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={
              mode === 'signup'
                ? 'Minimum 8 characters'
                : 'Your password'
            }
            autoComplete={
              mode === 'login'
                ? 'current-password'
                : 'new-password'
            }
          />

          {mode === 'signup' && (
            <Field
              label="CONFIRM PASSWORD"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
          )}

          {mode === 'login' && (
            <div className="forgot-row">
              <button
                type="button"
                className="forgot-button"
                disabled={loading}
                onClick={forgotPassword}
              >
                Forgot Password?
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="message error">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="message success">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="submit-button"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Login'
              : 'Create Account'}
          </button>
        </form>

        <div className="note">
          You can browse NightOutStays without
          logging in. Login is required when you
          request a booking, message a host, make
          a payment or access your account.
        </div>
      </section>

      <PageStyles />
    </main>
  );
}

function friendlyAuthError(
  error,
  fallback
) {
  const message =
    error?.message || '';

  const lower =
    message.toLowerCase();

  if (
    lower.includes(
      'invalid login credentials'
    )
  ) {
    return 'Incorrect email or password.';
  }

  if (
    lower.includes(
      'user already registered'
    )
  ) {
    return 'An account already exists with this email. Please login instead.';
  }

  if (
    lower.includes(
      'email not confirmed'
    )
  ) {
    return 'This older account is still awaiting email confirmation. Please contact support or reset the account.';
  }

  return message || fallback;
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}) {
  return (
    <div className="field">
      <label>{label}</label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
    </div>
  );
}

function PageStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
      }

      .page,
      .loading-page {
        min-height: 100vh;
        font-family: Arial, sans-serif;
        color: #11213c;
        background: #f5f7fa;
      }

      .page {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px 15px;
      }

      .loading-page {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .card {
        width: 100%;
        max-width: 460px;
        background: white;
        border: 1px solid #dfe3e8;
        border-radius: 18px;
        padding: 28px;
        box-shadow:
          0 10px 35px
          rgba(16, 24, 40, 0.08);
      }

      .brand {
        color: #17457f;
        font-size: 24px;
        font-weight: 900;
        margin-bottom: 18px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }

      .subtitle {
        color: #687080;
        line-height: 1.5;
        margin: 0 0 22px;
      }

      .tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        background: #f1f3f6;
        padding: 5px;
        border-radius: 10px;
        margin-bottom: 22px;
      }

      .tab {
        min-height: 44px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #687080;
        font-weight: 800;
        cursor: pointer;
      }

      .tab.active {
        background: #17457f;
        color: white;
      }

      .field {
        margin-bottom: 15px;
      }

      .field label {
        display: block;
        margin-bottom: 6px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .field input {
        width: 100%;
        min-height: 46px;
        padding: 12px;
        border: 1px solid #ccd1d8;
        border-radius: 10px;
        font-size: 16px;
        outline: none;
      }

      .field input:focus {
        border-color: #17457f;
      }

      .forgot-row {
        display: flex;
        justify-content: flex-end;
        margin: -4px 0 15px;
      }

      .forgot-button {
        min-height: 40px;
        border: 0;
        background: transparent;
        color: #17457f;
        font-weight: 700;
        cursor: pointer;
      }

      .message {
        padding: 12px;
        margin-bottom: 14px;
        border-radius: 9px;
        font-weight: 700;
        line-height: 1.4;
        font-size: 14px;
      }

      .message.error {
        background: #ffeaea;
        color: #8b2020;
      }

      .message.success {
        background: #eaf8ee;
        color: #25663a;
      }

      .submit-button {
        width: 100%;
        min-height: 48px;
        border: 0;
        border-radius: 10px;
        background: #17457f;
        color: white;
        font-size: 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .submit-button:disabled,
      .forgot-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .note {
        margin-top: 18px;
        padding: 12px;
        border-radius: 9px;
        background: #f7f8fa;
        color: #687080;
        font-size: 12px;
        line-height: 1.5;
      }

      @media (max-width: 520px) {
        .page {
          align-items: flex-start;
          padding: 18px 12px;
        }

        .card {
          padding: 22px 18px;
          border-radius: 14px;
        }

        h1 {
          font-size: 24px;
        }

        .brand {
          font-size: 22px;
        }
      }
    `}</style>
  );
}