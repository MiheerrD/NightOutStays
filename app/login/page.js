'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function GuestLoginPage() {
  const searchParams = useSearchParams();

  const redirectTo =
    searchParams.get('redirect') ||
    '/account/bookings';

  const [mode, setMode] =
    useState('login');

  const [fullName, setFullName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  useEffect(() => {
    checkExistingLogin();
  }, []);

  async function checkExistingLogin() {
    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (session) {
        window.location.href =
          redirectTo;
        return;
      }
    } finally {
      setCheckingSession(false);
    }
  }

  async function createGuestProfile(
    user,
    name
  ) {
    const {
      data: existingGuest,
      error: existingError,
    } =
      await supabase
        .from('guests')
        .select(
          'id, user_id, full_name, email'
        )
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingGuest) {
      return existingGuest;
    }

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from('guests')
        .insert({
          user_id:
            user.id,

          full_name:
            name.trim(),

          email:
            user.email,

          phone:
            null,
        })
        .select(
          'id, user_id, full_name, email'
        )
        .single();

    if (profileError) {
      throw profileError;
    }

    return profile;
  }

  async function handleSignup(
    event
  ) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage(
        'Please enter your full name.'
      );
      return;
    }

    if (!email.trim()) {
      setErrorMessage(
        'Please enter your email address.'
      );
      return;
    }

    if (
      password.length <
      6
    ) {
      setErrorMessage(
        'Password must be at least 6 characters.'
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        'Passwords do not match.'
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email:
            email.trim(),

          password,

          options: {
            data: {
              full_name:
                fullName.trim(),
            },
          },
        });

      if (error) {
        throw error;
      }

      if (
        data.user &&
        data.session
      ) {
        await createGuestProfile(
          data.user,
          fullName
        );

        window.location.href =
          redirectTo;

        return;
      }

      setSuccessMessage(
        'Account created. Please check your email to confirm your account, then log in.'
      );

      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to create account.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(
    event
  ) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (
      !email.trim() ||
      !password
    ) {
      setErrorMessage(
        'Enter your email and password.'
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword({
          email:
            email.trim(),

          password,
        });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          'Unable to login.'
        );
      }

      const name =
        data.user.user_metadata
          ?.full_name ||
        data.user.email?.split(
          '@'
        )[0] ||
        'Guest';

      await createGuestProfile(
        data.user,
        name
      );

      window.location.href =
        redirectTo;
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to login.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (
    checkingSession
  ) {
    return (
      <main style={styles.loadingPage}>
        Checking login...
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>
          NightOutStays
        </div>

        <h1 style={styles.heading}>
          {mode === 'login'
            ? 'Guest Login'
            : 'Create Guest Account'}
        </h1>

        <p style={styles.subtitle}>
          Sign in to request bookings, message hosts,
          make payments, view receipts and manage your stays.
        </p>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            style={{
              ...styles.tab,

              ...(mode ===
              'login'
                ? styles.activeTab
                : {}),
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            style={{
              ...styles.tab,

              ...(mode ===
              'signup'
                ? styles.activeTab
                : {}),
            }}
          >
            Sign Up
          </button>
        </div>

        <form
          onSubmit={
            mode ===
            'login'
              ? handleLogin
              : handleSignup
          }
        >
          {mode ===
            'signup' && (
            <Field
              label="FULL NAME"
              type="text"
              value={
                fullName
              }
              onChange={
                setFullName
              }
              placeholder="Your full name"
            />
          )}

          <Field
            label="EMAIL"
            type="email"
            value={email}
            onChange={
              setEmail
            }
            placeholder="you@example.com"
          />

          <Field
            label="PASSWORD"
            type="password"
            value={
              password
            }
            onChange={
              setPassword
            }
            placeholder="Password"
          />

          {mode ===
            'signup' && (
            <Field
              label="CONFIRM PASSWORD"
              type="password"
              value={
                confirmPassword
              }
              onChange={
                setConfirmPassword
              }
              placeholder="Re-enter password"
            />
          )}

          {errorMessage && (
            <div style={styles.error}>
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div style={styles.success}>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading
            }
            style={styles.submitButton}
          >
            {loading
              ? 'Please wait...'
              : mode ===
                'login'
              ? 'Login'
              : 'Create Account'}
          </button>
        </form>

        <div style={styles.note}>
          You can browse NightOutStays without logging in.
          Login is required only when you want to request a
          booking, message a host, pay or access your account.
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight:
      '100vh',
    display:
      'flex',
    justifyContent:
      'center',
    alignItems:
      'center',
    padding:
      '30px 15px',
    background:
      '#f5f7fa',
    fontFamily:
      'Arial, sans-serif',
    color:
      '#11213c',
  },

  loadingPage: {
    minHeight:
      '100vh',
    display:
      'flex',
    justifyContent:
      'center',
    alignItems:
      'center',
    background:
      '#f5f7fa',
    fontFamily:
      'Arial, sans-serif',
  },

  card: {
    width:
      '100%',
    maxWidth:
      460,
    background:
      '#ffffff',
    border:
      '1px solid #dfe3e8',
    borderRadius:
      18,
    padding:
      28,
    boxShadow:
      '0 10px 35px rgba(16,24,40,0.08)',
  },

  brand: {
    color:
      '#17457f',
    fontWeight:
      900,
    fontSize:
      24,
  },

  heading: {
    marginBottom:
      8,
  },

  subtitle: {
    color:
      '#687080',
    lineHeight:
      1.5,
    marginBottom:
      22,
  },

  tabs: {
    display:
      'grid',
    gridTemplateColumns:
      '1fr 1fr',
    gap:
      8,
    marginBottom:
      22,
    background:
      '#f1f3f6',
    padding:
      5,
    borderRadius:
      10,
  },

  tab: {
    border:
      0,
    background:
      'transparent',
    padding:
      10,
    borderRadius:
      8,
    fontWeight:
      800,
    cursor:
      'pointer',
    color:
      '#687080',
  },

  activeTab: {
    background:
      '#17457f',
    color:
      '#ffffff',
  },

  field: {
    marginBottom:
      15,
  },

  label: {
    display:
      'block',
    fontSize:
      10,
    fontWeight:
      900,
    letterSpacing:
      1,
    marginBottom:
      6,
  },

  input: {
    width:
      '100%',
    boxSizing:
      'border-box',
    border:
      '1px solid #ccd1d8',
    borderRadius:
      10,
    padding:
      12,
    fontSize:
      14,
  },

  error: {
    padding:
      12,
    background:
      '#ffeaea',
    color:
      '#8b2020',
    borderRadius:
      9,
    marginBottom:
      14,
    fontWeight:
      700,
  },

  success: {
    padding:
      12,
    background:
      '#eaf8ee',
    color:
      '#25663a',
    borderRadius:
      9,
    marginBottom:
      14,
    fontWeight:
      700,
  },

  submitButton: {
    width:
      '100%',
    border:
      0,
    background:
      '#17457f',
    color:
      '#ffffff',
    padding:
      14,
    borderRadius:
      10,
    fontWeight:
      900,
    fontSize:
      15,
    cursor:
      'pointer',
  },

  note: {
    marginTop:
      18,
    padding:
      12,
    background:
      '#f7f8fa',
    borderRadius:
      9,
    color:
      '#687080',
    fontSize:
      12,
    lineHeight:
      1.5,
  },
};