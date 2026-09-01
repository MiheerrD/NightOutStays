'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [checking, setChecking] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function prepareRecovery() {
      try {
        setChecking(true);
        setErrorMessage('');

        const url = new URL(window.location.href);

        /*
          NEW SUPABASE PKCE FLOW

          Recovery link may return:

          /reset-password?code=xxxxx

          We must exchange that code for a real session.
        */
        const code = url.searchParams.get('code');

        if (code) {
          const {
            data,
            error,
          } =
            await supabase.auth.exchangeCodeForSession(
              code
            );

          if (error) {
            throw error;
          }

          if (data?.session) {
            if (!active) return;

            setRecoveryReady(true);
            setChecking(false);

            /*
              Remove the one-time code from the browser URL
              after it has successfully been exchanged.
            */
            window.history.replaceState(
              {},
              document.title,
              '/reset-password'
            );

            return;
          }
        }

        /*
          OLDER / HASH-BASED FLOW

          Some Supabase recovery links establish the
          session automatically before this page loads.
        */
        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (sessionData?.session) {
          if (!active) return;

          setRecoveryReady(true);
          setChecking(false);
          return;
        }

        /*
          If neither a code nor an existing session
          is available, this is not a valid recovery page.
        */
        if (!active) return;

        setRecoveryReady(false);

        setErrorMessage(
          'This password recovery link is invalid or has expired.'
        );
      } catch (error) {
        console.error(
          'Password recovery initialization error:',
          error
        );

        if (!active) return;

        setRecoveryReady(false);

        const message =
          error?.message || '';

        if (
          message.toLowerCase().includes('expired') ||
          message.toLowerCase().includes('invalid') ||
          message.toLowerCase().includes('code')
        ) {
          setErrorMessage(
            'This password recovery link is invalid or has expired. Please request a new recovery email.'
          );
        } else {
          setErrorMessage(
            message ||
              'Unable to verify the password recovery link.'
          );
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    /*
      Also listen for Supabase auth events.

      This supports recovery links where Supabase
      establishes the session asynchronously.
    */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (
          event === 'PASSWORD_RECOVERY' &&
          session
        ) {
          setRecoveryReady(true);
          setChecking(false);
          setErrorMessage('');
        }
      }
    );

    prepareRecovery();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleResetPassword(event) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (password.length < 8) {
      setErrorMessage(
        'Password must be at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        'Passwords do not match.'
      );
      return;
    }

    if (!recoveryReady) {
      setErrorMessage(
        'Your password recovery session is no longer valid. Please request a new recovery email.'
      );
      return;
    }

    setLoading(true);

    try {
      /*
        Confirm we still have an authenticated
        recovery session before changing password.
      */
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData?.session) {
        throw new Error(
          'Password recovery session has expired.'
        );
      }

      /*
        Change password for the authenticated user.
      */
      const {
        data,
        error,
      } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          'Password could not be updated.'
        );
      }

      setPassword('');
      setConfirmPassword('');

      setSuccessMessage(
        'Password changed successfully. You can now login with your new password.'
      );

      /*
        End the recovery session.

        We want the guest to explicitly login using
        the newly-created password.
      */
      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href =
          '/login?passwordReset=success';
      }, 1800);
    } catch (error) {
      console.error(
        'Password update error:',
        error
      );

      const message =
        error?.message ||
        'Unable to update your password.';

      const lower = message.toLowerCase();

      if (lower.includes('same password')) {
        setErrorMessage(
          'Please choose a password different from your current password.'
        );
      } else if (
        lower.includes('expired') ||
        lower.includes('session')
      ) {
        setRecoveryReady(false);

        setErrorMessage(
          'Your password recovery session has expired. Please request a new recovery email.'
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function goToLogin() {
    /*
      Use href rather than replace().
      This gives us a simple direct navigation.
    */
    window.location.href = '/login';
  }

  if (checking) {
    return (
      <main className="page">
        <section className="card loading-card">
          <div className="brand">
            NightOutStays
          </div>

          <div className="spinner" />

          <p className="checking-text">
            Verifying your password recovery link...
          </p>
        </section>

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

        <h1>Reset Password</h1>

        {recoveryReady ? (
          <>
            <p className="subtitle">
              Create a new password for your
              NightOutStays account.
            </p>

            <form onSubmit={handleResetPassword}>
              <PasswordField
                label="NEW PASSWORD"
                value={password}
                onChange={setPassword}
                placeholder="Minimum 8 characters"
              />

              <PasswordField
                label="CONFIRM NEW PASSWORD"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter new password"
              />

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
                className="primary-button"
                disabled={
                  loading ||
                  Boolean(successMessage)
                }
              >
                {loading
                  ? 'Updating Password...'
                  : successMessage
                  ? 'Password Updated'
                  : 'Save New Password'}
              </button>

              {!successMessage && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={goToLogin}
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
            </form>
          </>
        ) : (
          <>
            <div className="message error">
              {errorMessage ||
                'This password recovery link is invalid or has expired.'}
            </div>

            <p className="subtitle">
              Request a new password recovery
              email from the login page.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={goToLogin}
            >
              Back to Login
            </button>
          </>
        )}

        <div className="security-note">
          Password recovery links are temporary
          and should only be used by the person
          who requested them.
        </div>
      </section>

      <PageStyles />
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div className="field">
      <label>{label}</label>

      <input
        type="password"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        autoComplete="new-password"
        minLength={8}
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

      .page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px 15px;
        background: #f5f7fa;
        font-family: Arial, sans-serif;
        color: #11213c;
      }

      .card {
        width: 100%;
        max-width: 460px;
        padding: 28px;
        background: #ffffff;
        border: 1px solid #dfe3e8;
        border-radius: 18px;
        box-shadow:
          0 10px 35px
          rgba(16, 24, 40, 0.08);
      }

      .loading-card {
        text-align: center;
      }

      .brand {
        margin-bottom: 18px;
        color: #17457f;
        font-size: 24px;
        font-weight: 900;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }

      .subtitle {
        margin: 0 0 22px;
        color: #687080;
        line-height: 1.5;
      }

      .checking-text {
        color: #687080;
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

      .message {
        margin-bottom: 14px;
        padding: 12px;
        border-radius: 9px;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
      }

      .message.error {
        background: #ffeaea;
        color: #8b2020;
      }

      .message.success {
        background: #eaf8ee;
        color: #25663a;
      }

      .primary-button,
      .secondary-button {
        width: 100%;
        min-height: 48px;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .primary-button {
        border: 0;
        background: #17457f;
        color: #ffffff;
      }

      .secondary-button {
        margin-top: 10px;
        border: 1px solid #17457f;
        background: #ffffff;
        color: #17457f;
      }

      .primary-button:disabled,
      .secondary-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .security-note {
        margin-top: 18px;
        padding: 12px;
        border-radius: 9px;
        background: #f7f8fa;
        color: #687080;
        font-size: 12px;
        line-height: 1.5;
      }

      .spinner {
        width: 34px;
        height: 34px;
        margin: 20px auto;
        border: 4px solid #e2e6eb;
        border-top-color: #17457f;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
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