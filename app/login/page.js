'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const PORTALS = [
  {
    key: 'guest',
    label: 'Guest',
    description: 'Book stays and manage your bookings',
  },
  {
    key: 'host',
    label: 'Host',
    description: 'Manage your properties and bookings',
  },
  {
    key: 'admin',
    label: 'Super Admin',
    description: 'Manage the complete NightOutStays platform',
  },
];

export default function LoginPage() {
  const [portal, setPortal] = useState('guest');
  const [mode, setMode] = useState('login');

  const [redirectTo, setRedirectTo] =
    useState('/account/bookings');

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
    initialisePage();
  }, []);

  async function initialisePage() {
    try {
      let destination =
        '/account/bookings';

      let requestedPortal = 'guest';

      if (typeof window !== 'undefined') {
        const params =
          new URLSearchParams(
            window.location.search
          );

        const requestedRedirect =
          params.get('redirect');

        const portalParam =
          params.get('portal');

        if (
          requestedRedirect &&
          requestedRedirect.startsWith('/') &&
          !requestedRedirect.startsWith('//')
        ) {
          destination =
            requestedRedirect;
        }

        if (
          portalParam === 'guest' ||
          portalParam === 'host' ||
          portalParam === 'admin'
        ) {
          requestedPortal =
            portalParam;
        }
      }

      setRedirectTo(destination);
      setPortal(requestedPortal);

      const {
        data: { session },
        error,
      } =
        await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session?.user) {
        await routeLoggedInUser(
          session.user,
          requestedPortal,
          destination
        );

        return;
      }
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          'Unable to check login status.'
      );
    } finally {
      setCheckingSession(false);
    }
  }

  function clearMessages() {
    setErrorMessage('');
    setSuccessMessage('');
  }

  function changePortal(nextPortal) {
    setPortal(nextPortal);

    clearMessages();

    setMode('login');

    setPassword('');
    setConfirmPassword('');
  }

  function switchMode(nextMode) {
    setMode(nextMode);

    clearMessages();

    setPassword('');
    setConfirmPassword('');
  }

  async function getPlatformRoles() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_my_platform_roles'
      );

    if (error) {
      console.error(
        'Role lookup error:',
        error
      );

      return [];
    }

    return data || [];
  }

  async function routeLoggedInUser(
    user,
    selectedPortal = 'guest',
    requestedDestination =
      '/account/bookings'
  ) {
    const roles =
      await getPlatformRoles();

    const isSuperAdmin =
      roles.some(
        (item) =>
          item.role === 'super_admin' &&
          item.is_active === true
      );

    const isHost =
      roles.some(
        (item) =>
          item.role === 'host' &&
          item.is_active === true
      );

    if (selectedPortal === 'admin') {
      if (!isSuperAdmin) {
        await supabase.auth.signOut();

        throw new Error(
          'This account does not have Super Admin access.'
        );
      }

      window.location.replace(
        '/admin'
      );

      return;
    }

    if (selectedPortal === 'host') {
      if (!isHost) {
        await supabase.auth.signOut();

        throw new Error(
          'This account does not have an active Host profile.'
        );
      }

      window.location.replace(
        '/host'
      );

      return;
    }

    if (isSuperAdmin) {
      window.location.replace(
        '/admin'
      );

      return;
    }

    if (isHost) {
      window.location.replace(
        '/host'
      );

      return;
    }

    await ensureGuestProfile(
      user,
      user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'Guest'
    );

    let guestDestination =
      requestedDestination ||
      '/account/bookings';

    if (
      guestDestination.startsWith('/admin') ||
      guestDestination.startsWith('/host')
    ) {
      guestDestination =
        '/account/bookings';
    }

    window.location.replace(
      guestDestination
    );
  }

  async function ensureGuestProfile(
    user,
    suppliedName = ''
  ) {
    if (!user?.id) {
      throw new Error(
        'Guest account information is missing.'
      );
    }

    const normalizedEmail =
      user.email
        ?.trim()
        .toLowerCase() || null;

    const {
      data: existingByUser,
      error: userLookupError,
    } =
      await supabase
        .from('guests')
        .select(
          'id, user_id, full_name, email, phone'
        )
        .eq('user_id', user.id)
        .maybeSingle();

    if (userLookupError) {
      throw userLookupError;
    }

    if (existingByUser) {
      const updates = {};

      if (
        !existingByUser.full_name &&
        suppliedName.trim()
      ) {
        updates.full_name =
          suppliedName.trim();
      }

      if (
        !existingByUser.email &&
        normalizedEmail
      ) {
        updates.email =
          normalizedEmail;
      }

      if (
        Object.keys(updates).length > 0
      ) {
        const {
          data: updatedGuest,
          error: updateError,
        } =
          await supabase
            .from('guests')
            .update(updates)
            .eq(
              'id',
              existingByUser.id
            )
            .select(
              'id, user_id, full_name, email, phone'
            )
            .single();

        if (updateError) {
          throw updateError;
        }

        return updatedGuest;
      }

      return existingByUser;
    }

    if (normalizedEmail) {
      const {
        data: existingByEmail,
        error: emailLookupError,
      } =
        await supabase
          .from('guests')
          .select(
            'id, user_id, full_name, email, phone'
          )
          .eq(
            'email',
            normalizedEmail
          )
          .is('user_id', null)
          .maybeSingle();

      if (emailLookupError) {
        throw emailLookupError;
      }

      if (existingByEmail) {
        const {
          data: linkedGuest,
          error: linkError,
        } =
          await supabase
            .from('guests')
            .update({
              user_id: user.id,

              full_name:
                existingByEmail.full_name ||
                suppliedName.trim() ||
                user.user_metadata
                  ?.full_name ||
                normalizedEmail.split(
                  '@'
                )[0],
            })
            .eq(
              'id',
              existingByEmail.id
            )
            .select(
              'id, user_id, full_name, email, phone'
            )
            .single();

        if (linkError) {
          throw linkError;
        }

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
    } =
      await supabase
        .from('guests')
        .insert({
          user_id: user.id,
          full_name: guestName,
          email: normalizedEmail,
          phone: null,
        })
        .select(
          'id, user_id, full_name, email, phone'
        )
        .single();

    if (insertError) {
      throw insertError;
    }

    return newGuest;
  }

  async function handleSignup(event) {
    event.preventDefault();

    clearMessages();

    if (portal !== 'guest') {
      setErrorMessage(
        'Guest sign up is available only for Guest accounts.'
      );

      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!fullName.trim()) {
      setErrorMessage(
        'Please enter your full name.'
      );

      return;
    }

    if (!normalizedEmail) {
      setErrorMessage(
        'Please enter your email address.'
      );

      return;
    }

    if (password.length < 8) {
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

    setLoading(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email:
            normalizedEmail,

          password,

          options: {
            data: {
              full_name:
                fullName.trim(),

              account_type:
                'guest',
            },
          },
        });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          'Unable to create your account.'
        );
      }

      if (!data.session) {
        throw new Error(
          'Account was created but automatic login was not completed. Please try logging in.'
        );
      }

      await ensureGuestProfile(
        data.user,
        fullName
      );

      window.location.replace(
        redirectTo
      );
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

    const normalizedEmail =
      email.trim().toLowerCase();

    if (
      !normalizedEmail ||
      !password
    ) {
      setErrorMessage(
        'Please enter your email and password.'
      );

      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              normalizedEmail,

            password,
          });

      if (error) {
        throw error;
      }

      if (
        !data.user ||
        !data.session
      ) {
        throw new Error(
          'Unable to login.'
        );
      }

      await routeLoggedInUser(
        data.user,
        portal,
        redirectTo
      );
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

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage(
        'Enter your registered email address first.'
      );

      return;
    }

    setLoading(true);

    try {
      const origin =
        typeof window !==
        'undefined'
          ? window.location.origin
          : 'https://nightoutstay.com';

      const { error } =
        await supabase.auth
          .resetPasswordForEmail(
            normalizedEmail,
            {
              redirectTo:
                `${origin}/reset-password`,
            }
          );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        'Password recovery email sent. Please check your inbox.'
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
      <main className="loginLoading">
        Checking login...

        <PageStyles />
      </main>
    );
  }

  const selectedPortal =
    PORTALS.find(
      (item) =>
        item.key === portal
    );

  return (
    <main className="loginPage">
      <div className="loginShell">
        <section className="loginIntro">
          <a
            href="/"
            className="loginBrand"
          >
            NightOutStays
          </a>

          <div className="loginIntroContent">
            <span className="loginEyebrow">
              NIGHTOUTSTAYS ACCOUNT
            </span>

            <h1>
              Welcome back
            </h1>

            <p>
              Login as Guest, Host or Super Admin
              and continue to your own NightOutStays
              dashboard.
            </p>

            <div className="loginFeatures">
              <div>
                <strong>
                  Guest
                </strong>

                <span>
                  Search stays, bookings, messages
                  and profile.
                </span>
              </div>

              <div>
                <strong>
                  Host
                </strong>

                <span>
                  Manage properties, bookings,
                  calendar and offers.
                </span>
              </div>

              <div>
                <strong>
                  Super Admin
                </strong>

                <span>
                  Control hosts, properties,
                  bookings and platform settings.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="loginCard">
          <div className="loginMobileBrand">
            NightOutStays
          </div>

          <div className="portalSelector">
            {PORTALS.map(
              (item) => (
                <button
                  key={item.key}
                  type="button"
                  className={
                    portal === item.key
                      ? 'portalButton active'
                      : 'portalButton'
                  }
                  onClick={() =>
                    changePortal(
                      item.key
                    )
                  }
                >
                  <strong>
                    {item.label}
                  </strong>

                  <span>
                    {
                      item.description
                    }
                  </span>
                </button>
              )
            )}
          </div>

          <div className="loginHeading">
            <span>
              {portal === 'guest'
                ? 'GUEST PORTAL'
                : portal === 'host'
                  ? 'HOST PORTAL'
                  : 'SUPER ADMIN PORTAL'}
            </span>

            <h2>
              {mode === 'signup'
                ? 'Create Guest Account'
                : `${selectedPortal?.label || 'Account'} Login`}
            </h2>

            <p>
              {mode === 'signup'
                ? 'Create your NightOutStays guest account.'
                : `Enter your registered ${selectedPortal?.label || ''} account details.`}
            </p>
          </div>

          {portal === 'guest' && (
            <div className="modeTabs">
              <button
                type="button"
                className={
                  mode === 'login'
                    ? 'modeButton active'
                    : 'modeButton'
                }
                onClick={() =>
                  switchMode(
                    'login'
                  )
                }
              >
                Login
              </button>

              <button
                type="button"
                className={
                  mode === 'signup'
                    ? 'modeButton active'
                    : 'modeButton'
                }
                onClick={() =>
                  switchMode(
                    'signup'
                  )
                }
              >
                Guest Sign Up
              </button>
            </div>
          )}

          <form
            onSubmit={
              mode === 'signup'
                ? handleSignup
                : handleLogin
            }
          >
            {mode === 'signup' && (
              <Field
                label="FULL NAME"
                type="text"
                value={fullName}
                onChange={
                  setFullName
                }
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
                mode === 'signup'
                  ? 'new-password'
                  : 'current-password'
              }
            />

            {mode === 'signup' && (
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
                autoComplete="new-password"
              />
            )}

            {mode === 'login' && (
              <div className="forgotRow">
                <button
                  type="button"
                  disabled={loading}
                  className="forgotButton"
                  onClick={
                    forgotPassword
                  }
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="loginMessage error">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="loginMessage success">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              className="loginSubmit"
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : mode === 'signup'
                  ? 'Create Guest Account'
                  : `Login as ${selectedPortal?.label || ''}`}
            </button>
          </form>

          {portal === 'host' && (
            <div className="hostRegisterBox">
              <div>
                <strong>
                  New Host?
                </strong>

                <span>
                  Create your Host account and
                  start listing properties.
                </span>
              </div>

              <a
                href="/host/register"
              >
                Register as Host
              </a>
            </div>
          )}

          {portal === 'admin' && (
            <div className="adminNote">
              Super Admin accounts are created
              internally. Public Super Admin
              registration is not available.
            </div>
          )}

          <a
            href="/"
            className="backHome"
          >
            ← Back to NightOutStays
          </a>
        </section>
      </div>

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
    return 'This account is awaiting email confirmation.';
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
    <div className="loginField">
      <label>
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

      .loginPage,
      .loginLoading {
        min-height: 100vh;
        font-family:
          Arial,
          sans-serif;
        color: #10233f;
        background: #f4f7fb;
      }

      .loginLoading {
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
      }

      .loginPage {
        display: flex;
        align-items: stretch;
        justify-content: center;
      }

      .loginShell {
        width: 100%;
        min-height: 100vh;

        display: grid;

        grid-template-columns:
          minmax(360px, 0.9fr)
          minmax(500px, 1.1fr);
      }

      .loginIntro {
        position: relative;

        display: flex;
        flex-direction: column;

        padding:
          38px 48px 55px;

        color: white;

        background:
          radial-gradient(
            circle at 15% 10%,
            rgba(
              255,
              255,
              255,
              0.12
            ),
            transparent 30%
          ),
          linear-gradient(
            145deg,
            #06386e 0%,
            #061d3b 100%
          );
      }

      .loginBrand,
      .loginMobileBrand {
        color: inherit;

        font-size: 29px;
        font-weight: 900;

        letter-spacing: -0.8px;

        text-decoration: none;
      }

      .loginIntroContent {
        margin: auto 0;
        max-width: 520px;
      }

      .loginEyebrow {
        display: block;

        margin-bottom: 14px;

        color:
          rgba(
            255,
            255,
            255,
            0.7
          );

        font-size: 11px;
        font-weight: 900;

        letter-spacing: 1.2px;
      }

      .loginIntroContent h1 {
        margin: 0 0 14px;

        font-size: 48px;
        line-height: 1.05;

        letter-spacing: -1.5px;
      }

      .loginIntroContent > p {
        margin: 0;

        color:
          rgba(
            255,
            255,
            255,
            0.77
          );

        font-size: 16px;
        line-height: 1.65;
      }

      .loginFeatures {
        display: grid;
        gap: 12px;

        margin-top: 35px;
      }

      .loginFeatures > div {
        display: flex;
        flex-direction: column;
        gap: 4px;

        padding: 15px 16px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            0.12
          );

        border-radius: 12px;

        background:
          rgba(
            255,
            255,
            255,
            0.05
          );
      }

      .loginFeatures strong {
        font-size: 14px;
      }

      .loginFeatures span {
        color:
          rgba(
            255,
            255,
            255,
            0.67
          );

        font-size: 12px;
        line-height: 1.5;
      }

      .loginCard {
        width: 100%;
        max-width: 650px;

        align-self: center;

        margin: 40px auto;

        padding: 35px;

        border:
          1px solid
          #dde4ed;

        border-radius: 20px;

        background: white;

        box-shadow:
          0 18px 55px
          rgba(
            13,
            42,
            76,
            0.08
          );
      }

      .loginMobileBrand {
        display: none;
        color: #0c427c;
        margin-bottom: 22px;
      }

      .portalSelector {
        display: grid;

        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );

        gap: 9px;

        margin-bottom: 27px;
      }

      .portalButton {
        min-height: 90px;

        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;

        gap: 6px;

        padding: 13px;

        border:
          1px solid
          #dce3ec;

        border-radius: 12px;

        background: #fafbfd;
        color: #44546a;

        text-align: left;

        cursor: pointer;
      }

      .portalButton strong {
        color: #17263b;
        font-size: 14px;
      }

      .portalButton span {
        color: #748094;
        font-size: 10px;
        line-height: 1.4;
      }

      .portalButton.active {
        border-color: #0b4b8d;
        background:
          linear-gradient(
            145deg,
            #0a4e91,
            #083867
          );

        color: white;
      }

      .portalButton.active strong,
      .portalButton.active span {
        color: white;
      }

      .loginHeading {
        margin-bottom: 19px;
      }

      .loginHeading > span {
        display: block;

        margin-bottom: 7px;

        color: #758398;

        font-size: 10px;
        font-weight: 900;

        letter-spacing: 1px;
      }

      .loginHeading h2 {
        margin: 0;

        color: #10233f;

        font-size: 29px;

        letter-spacing: -0.6px;
      }

      .loginHeading p {
        margin: 7px 0 0;

        color: #6c788a;

        font-size: 13px;
        line-height: 1.5;
      }

      .modeTabs {
        display: grid;

        grid-template-columns:
          1fr 1fr;

        gap: 6px;

        margin-bottom: 19px;

        padding: 5px;

        border-radius: 10px;

        background: #f1f4f7;
      }

      .modeButton {
        min-height: 41px;

        border: 0;
        border-radius: 8px;

        background: transparent;
        color: #68768a;

        font-weight: 800;

        cursor: pointer;
      }

      .modeButton.active {
        background: white;
        color: #0b4b8d;

        box-shadow:
          0 1px 5px
          rgba(
            16,
            24,
            40,
            0.08
          );
      }

      .loginField {
        margin-bottom: 14px;
      }

      .loginField label {
        display: block;

        margin-bottom: 6px;

        color: #5d6b80;

        font-size: 10px;
        font-weight: 900;

        letter-spacing: 0.9px;
      }

      .loginField input {
        width: 100%;
        min-height: 47px;

        padding: 12px 13px;

        border:
          1px solid
          #ccd5df;

        border-radius: 9px;

        background: white;

        color: #10233f;

        font-size: 15px;

        outline: none;
      }

      .loginField input:focus {
        border-color: #0b4b8d;

        box-shadow:
          0 0 0 3px
          rgba(
            11,
            75,
            141,
            0.08
          );
      }

      .forgotRow {
        display: flex;
        justify-content: flex-end;

        margin:
          -4px 0 15px;
      }

      .forgotButton {
        border: 0;

        background: transparent;
        color: #0b4b8d;

        font-weight: 700;

        cursor: pointer;
      }

      .loginMessage {
        margin-bottom: 14px;

        padding: 11px 12px;

        border-radius: 8px;

        font-size: 13px;
        font-weight: 700;

        line-height: 1.45;
      }

      .loginMessage.error {
        border:
          1px solid
          #f0b2ad;

        background: #fff3f2;
        color: #a82319;
      }

      .loginMessage.success {
        border:
          1px solid
          #a9dfba;

        background: #eefaf2;
        color: #16733a;
      }

      .loginSubmit {
        width: 100%;
        min-height: 49px;

        border: 0;
        border-radius: 9px;

        background:
          linear-gradient(
            90deg,
            #0a4f93,
            #083c70
          );

        color: white;

        font-size: 14px;
        font-weight: 900;

        cursor: pointer;
      }

      .loginSubmit:disabled,
      .forgotButton:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .hostRegisterBox {
        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 16px;

        margin-top: 20px;

        padding: 15px;

        border:
          1px solid
          #dce3ec;

        border-radius: 11px;

        background: #f9fbfd;
      }

      .hostRegisterBox > div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .hostRegisterBox strong {
        font-size: 13px;
      }

      .hostRegisterBox span {
        color: #6d798b;
        font-size: 11px;
        line-height: 1.45;
      }

      .hostRegisterBox a {
        flex-shrink: 0;

        min-height: 39px;

        display: inline-flex;
        align-items: center;
        justify-content: center;

        padding: 0 13px;

        border-radius: 8px;

        background: #111d30;
        color: white;

        text-decoration: none;

        font-size: 11px;
        font-weight: 900;
      }

      .adminNote {
        margin-top: 19px;

        padding: 12px 13px;

        border:
          1px solid
          #dce3ec;

        border-radius: 9px;

        background: #f8fafc;

        color: #69768a;

        font-size: 11px;
        line-height: 1.5;
      }

      .backHome {
        display: block;

        margin-top: 20px;

        color: #53647c;

        font-size: 12px;
        font-weight: 700;

        text-decoration: none;
        text-align: center;
      }

      @media (
        max-width: 950px
      ) {
        .loginShell {
          grid-template-columns: 1fr;
        }

        .loginIntro {
          display: none;
        }

        .loginCard {
          margin:
            28px auto;

          width:
            min(
              calc(
                100% - 28px
              ),
              650px
            );
        }

        .loginMobileBrand {
          display: block;
        }
      }

      @media (
        max-width: 580px
      ) {
        .loginCard {
          padding:
            24px 17px;

          border-radius: 14px;
        }

        .portalSelector {
          grid-template-columns: 1fr;
        }

        .portalButton {
          min-height: 68px;
        }

        .loginHeading h2 {
          font-size: 25px;
        }

        .hostRegisterBox {
          flex-direction: column;
          align-items: stretch;
        }

        .hostRegisterBox a {
          width: 100%;
        }
      }
    `}</style>
  );
}