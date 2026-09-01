'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function ResetPasswordPage() {
  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [checking, setChecking] =
    useState(true);

  const [recoveryReady, setRecoveryReady] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  useEffect(() => {
    let mounted = true;

    async function initialiseRecovery() {
      try {
        /*
          Supabase recovery links may establish the
          session before this page finishes loading.
        */

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (
          mounted &&
          session
        ) {
          setRecoveryReady(true);
        }
      } catch (error) {
        console.error(error);

        if (mounted) {
          setErrorMessage(
            error?.message ||
              'Unable to verify the password recovery link.'
          );
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    /*
      Listen for the PASSWORD_RECOVERY event.

      This is important when Supabase establishes
      the recovery session after the page loads.
    */

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) {
            return;
          }

          if (
            event ===
              'PASSWORD_RECOVERY' &&
            session
          ) {
            setRecoveryReady(true);
            setChecking(false);
            setErrorMessage('');
          }
        }
      );

    initialiseRecovery();

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  async function handleResetPassword(
    event
  ) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (
      password.length < 8
    ) {
      setErrorMessage(
        'Password must be at least 8 characters.'
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

    if (!recoveryReady) {
      setErrorMessage(
        'This password recovery link is invalid or has expired. Please request a new password reset email.'
      );

      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.updateUser({
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

      setSuccessMessage(
        'Your password has been changed successfully. Redirecting you to login...'
      );

      setPassword('');
      setConfirmPassword('');

      /*
        Sign out the recovery session so the guest
        explicitly logs in with the new password.
      */

      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.replace(
          '/login?passwordReset=success'
        );
      }, 1800);
    } catch (error) {
      console.error(error);

      const message =
        error?.message ||
        'Unable to update your password.';

      if (
        message
          .toLowerCase()
          .includes('same password')
      ) {
        setErrorMessage(
          'Please choose a password different from your current password.'
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function requestNewLink() {
    window.location.replace(
      '/login'
    );
  }

  if (checking) {
    return (
      <main className="page">
        <section className="card loading-card">
          <div className="brand">
            NightOutStays
          </div>

          <div className="spinner" />

          <p>
            Verifying your password
            recovery link...
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

        <h1>
          Reset Password
        </h1>

        {recoveryReady ? (
          <>
            <p className="subtitle">
              Create a new password for
              your NightOutStays account.
            </p>

            <form
              onSubmit={
                handleResetPassword
              }
            >
              <Field
                label="NEW PASSWORD"
                value={password}
                onChange={setPassword}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />

              <Field
                label="CONFIRM NEW PASSWORD"
                value={confirmPassword}
                onChange={
                  setConfirmPassword
                }
                placeholder="Re-enter new password"
                autoComplete="new-password"
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
                disabled={
                  loading ||
                  Boolean(successMessage)
                }
                className="primary-button"
              >
                {loading
                  ? 'Updating Password...'
                  : successMessage
                  ? 'Password Updated'
                  : 'Save New Password'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="message error">
              {errorMessage ||
                'This password recovery link is invalid or has expired.'}
            </div>

            <p className="subtitle">
              Please request a new
              password recovery email
              from the login page.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={requestNewLink}
            >
              Back to Login
            </button>
          </>
        )}

        <div className="security-note">
          For your security, password
          recovery links should only be
          used by the person who requested
          them.
        </div>
      </section>

      <PageStyles />
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}) {
  return (
    <div className="field">
      <label>
        {label}
      </label>

      <input
        type="password"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
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

      .page {
        min-height: 100vh;

        display: flex;
        align-items: center;
        justify-content: center;

        padding: 28px 15px;

        background: #f5f7fa;

        font-family:
          Arial,
          sans-serif;

        color: #11213c;
      }

      .card {
        width: 100%;
        max-width: 460px;

        padding: 28px;

        background: #ffffff;

        border:
          1px solid
          #dfe3e8;

        border-radius: 18px;

        box-shadow:
          0 10px 35px
          rgba(
            16,
            24,
            40,
            0.08
          );
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
        margin:
          0 0 8px;

        font-size: 28px;
      }

      .subtitle {
        margin:
          0 0 22px;

        color: #687080;

        line-height: 1.5;
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

        border:
          1px solid
          #ccd1d8;

        border-radius: 10px;

        font-size: 16px;

        outline: none;
      }

      .field input:focus {
        border-color:
          #17457f;
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
        background:
          #ffeaea;

        color:
          #8b2020;
      }

      .message.success {
        background:
          #eaf8ee;

        color:
          #25663a;
      }

      .primary-button {
        width: 100%;

        min-height: 48px;

        border: 0;

        border-radius: 10px;

        background:
          #17457f;

        color:
          #ffffff;

        font-size: 15px;
        font-weight: 900;

        cursor: pointer;
      }

      .primary-button:disabled {
        opacity: 0.6;

        cursor:
          not-allowed;
      }

      .security-note {
        margin-top: 18px;

        padding: 12px;

        border-radius: 9px;

        background:
          #f7f8fa;

        color:
          #687080;

        font-size: 12px;

        line-height: 1.5;
      }

      .spinner {
        width: 34px;
        height: 34px;

        margin:
          20px auto;

        border:
          4px solid
          #e2e6eb;

        border-top-color:
          #17457f;

        border-radius: 50%;

        animation:
          spin 0.8s
          linear infinite;
      }

      @keyframes spin {
        to {
          transform:
            rotate(360deg);
        }
      }

      @media (
        max-width: 520px
      ) {
        .page {
          align-items:
            flex-start;

          padding:
            18px 12px;
        }

        .card {
          padding:
            22px 18px;

          border-radius:
            14px;
        }

        h1 {
          font-size:
            24px;
        }

        .brand {
          font-size:
            22px;
        }
      }
    `}</style>
  );
}