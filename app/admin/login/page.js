'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [error, setError] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setChecking(false);
        return;
      }

      const allowed =
        await checkAdminAccess();

      if (allowed) {
        router.replace('/admin');
        return;
      }

      /*
        Important:
        If somebody is already logged in as a
        Guest or Host, we do NOT automatically
        sign them out here.

        They can enter their Admin credentials
        using this private portal.
      */

      setChecking(false);
    } catch (err) {
      console.error(err);
      setChecking(false);
    }
  }

  async function checkAdminAccess() {
    try {
      const {
        data: roles,
        error: roleError,
      } = await supabase.rpc(
        'get_my_platform_roles'
      );

      if (roleError) {
        throw roleError;
      }

      const hasAdminRole =
        (roles || []).some(
          (item) =>
            (
              item.role === 'super_admin' ||
              item.role === 'admin'
            ) &&
            item.is_active === true
        );

      if (!hasAdminRole) {
        return false;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('admin_profiles')
        .select(
          `
            user_id,
            full_name,
            email,
            role,
            is_active,
            full_access
          `
        )
        .eq(
          'user_id',
          (
            await supabase.auth.getUser()
          ).data.user.id
        )
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile ||
        !profile.is_active
      ) {
        return false;
      }

      if (
        profile.role !== 'super_admin' &&
        profile.role !== 'admin'
      ) {
        return false;
      }

      return true;
    } catch (err) {
      console.error(
        'Admin access check:',
        err
      );

      return false;
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);
    setError('');

    try {
      const cleanEmail =
        email.trim().toLowerCase();

      if (!cleanEmail || !password) {
        throw new Error(
          'Please enter your email and password.'
        );
      }

      const {
        error: signInError,
      } =
        await supabase.auth
          .signInWithPassword({
            email: cleanEmail,
            password,
          });

      if (signInError) {
        throw new Error(
          'Invalid email or password.'
        );
      }

      const allowed =
        await checkAdminAccess();

      if (!allowed) {
        await supabase.auth.signOut();

        throw new Error(
          'This account does not have access to this portal.'
        );
      }

      router.replace('/admin');
      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to login.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError('');

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setError(
        'Enter your email address first, then click Forgot Password.'
      );

      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        `${window.location.origin}/reset-password`;

      const {
        error: resetError,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            cleanEmail,
            {
              redirectTo,
            }
          );

      if (resetError) {
        throw resetError;
      }

      alert(
        'Password reset email sent. Please check your inbox.'
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to send password reset email.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <>
        <main className="adminLoginLoading">
          Checking secure access...
        </main>

        <Styles />
      </>
    );
  }

  return (
    <>
      <main className="adminLoginPage">
        <section className="adminLoginBrand">
          <div className="brandInner">
            <a
              href="/"
              className="brandName"
            >
              NightOutStays
            </a>

            <div className="brandContent">
              <span className="secureBadge">
                SECURE ADMIN PORTAL
              </span>

              <h1>
                NightOutStays
                <br />
                Administration
              </h1>

              <p>
                Private access for authorized
                NightOutStays administrators.
              </p>

              <div className="securityList">
                <div className="securityItem">
                  <span className="securityIcon">
                    ✓
                  </span>

                  <div>
                    <strong>
                      Super Admin
                    </strong>

                    <p>
                      Complete control over
                      NightOutStays.
                    </p>
                  </div>
                </div>

                <div className="securityItem">
                  <span className="securityIcon">
                    ✓
                  </span>

                  <div>
                    <strong>
                      Authorized Admins
                    </strong>

                    <p>
                      Access is controlled by
                      permissions assigned by
                      Super Admin.
                    </p>
                  </div>
                </div>

                <div className="securityItem">
                  <span className="securityIcon">
                    ✓
                  </span>

                  <div>
                    <strong>
                      Protected Access
                    </strong>

                    <p>
                      Guest and Host accounts
                      cannot access this portal.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="brandFooter">
              NightOutStays Admin System
            </div>
          </div>
        </section>

        <section className="adminLoginFormSide">
          <div className="adminLoginCard">
            <div className="lockIcon">
              <span>◆</span>
            </div>

            <span className="formEyebrow">
              AUTHORIZED ACCESS ONLY
            </span>

            <h2>
              Admin Login
            </h2>

            <p className="loginDescription">
              Enter your authorized Admin
              credentials to continue.
            </p>

            {error && (
              <div className="loginError">
                {error}
              </div>
            )}

            <form
              onSubmit={handleLogin}
              className="loginForm"
            >
              <label>
                <span>
                  EMAIL ADDRESS
                </span>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="Enter admin email"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                <div className="passwordLabel">
                  <span>
                    PASSWORD
                  </span>

                  <button
                    type="button"
                    onClick={
                      handleForgotPassword
                    }
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="passwordField">
                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="showPassword"
                    onClick={() =>
                      setShowPassword(
                        (previous) =>
                          !previous
                      )
                    }
                  >
                    {showPassword
                      ? 'Hide'
                      : 'Show'}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                className="adminLoginButton"
                disabled={loading}
              >
                {loading
                  ? 'Verifying Access...'
                  : 'Login to Admin Portal'}
              </button>
            </form>

            <div className="adminLoginNotice">
              <span>🔒</span>

              <p>
                This portal is restricted to
                authorized NightOutStays
                administrators.
              </p>
            </div>

            <a
              href="/"
              className="backWebsite"
            >
              ← Back to NightOutStays
            </a>
          </div>
        </section>
      </main>

      <Styles />
    </>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }

      .adminLoginPage {
        width: 100%;
        min-height: 100vh;
        display: grid;
        grid-template-columns:
          minmax(380px, 44%)
          minmax(450px, 56%);
        background: #ffffff;
        color: #101828;
      }

      .adminLoginBrand {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        background:
          radial-gradient(
            circle at 20% 20%,
            rgba(42, 103, 170, 0.35),
            transparent 34%
          ),
          radial-gradient(
            circle at 90% 80%,
            rgba(25, 77, 133, 0.28),
            transparent 38%
          ),
          linear-gradient(
            145deg,
            #07182d 0%,
            #0b2747 52%,
            #07182d 100%
          );
        color: #ffffff;
      }

      .adminLoginBrand::after {
        content: '';
        position: absolute;
        width: 380px;
        height: 380px;
        border: 1px solid
          rgba(255, 255, 255, 0.07);
        border-radius: 50%;
        right: -170px;
        top: 20%;
      }

      .brandInner {
        position: relative;
        z-index: 2;
        width: 100%;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 45px 55px 35px;
      }

      .brandName {
        width: fit-content;
        color: #ffffff;
        font-size: 23px;
        font-weight: 900;
        text-decoration: none;
        letter-spacing: -0.5px;
      }

      .brandContent {
        width: 100%;
        max-width: 500px;
        margin: auto 0;
        padding: 60px 0;
      }

      .secureBadge {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 0 11px;
        margin-bottom: 20px;
        border: 1px solid
          rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        background:
          rgba(255, 255, 255, 0.07);
        color: #c9d9ea;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1.3px;
      }

      .brandContent h1 {
        margin: 0;
        font-size: clamp(
          36px,
          4vw,
          58px
        );
        line-height: 1.05;
        letter-spacing: -2px;
      }

      .brandContent > p {
        max-width: 420px;
        margin: 20px 0 0;
        color: #b7c8da;
        font-size: 15px;
        line-height: 1.7;
      }

      .securityList {
        display: flex;
        flex-direction: column;
        gap: 13px;
        margin-top: 35px;
      }

      .securityItem {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 13px 15px;
        border: 1px solid
          rgba(255, 255, 255, 0.09);
        border-radius: 11px;
        background:
          rgba(255, 255, 255, 0.045);
      }

      .securityIcon {
        width: 25px;
        height: 25px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #ffffff;
        color: #0a2a4d;
        font-size: 12px;
        font-weight: 900;
      }

      .securityItem strong {
        display: block;
        margin-top: 1px;
        font-size: 12px;
      }

      .securityItem p {
        margin: 3px 0 0;
        color: #aebfd0;
        font-size: 11px;
        line-height: 1.45;
      }

      .brandFooter {
        color: #8197ad;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.4px;
      }

      .adminLoginFormSide {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 55px 35px;
        background:
          linear-gradient(
            180deg,
            #ffffff 0%,
            #f9fbfd 100%
          );
      }

      .adminLoginCard {
        width: 100%;
        max-width: 430px;
      }

      .lockIcon {
        width: 46px;
        height: 46px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 21px;
        border-radius: 12px;
        background: #e9f1fa;
        color: #0b4f91;
        font-size: 17px;
      }

      .formEyebrow {
        display: block;
        margin-bottom: 7px;
        color: #667085;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1.2px;
      }

      .adminLoginCard h2 {
        margin: 0;
        color: #101828;
        font-size: 31px;
        letter-spacing: -0.8px;
      }

      .loginDescription {
        margin: 8px 0 27px;
        color: #667085;
        font-size: 13px;
        line-height: 1.6;
      }

      .loginForm {
        display: flex;
        flex-direction: column;
        gap: 17px;
      }

      .loginForm label {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .loginForm label > span,
      .passwordLabel > span {
        color: #475467;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.8px;
      }

      .loginForm input {
        width: 100%;
        min-height: 48px;
        border: 1px solid #cfd8e3;
        border-radius: 9px;
        background: #ffffff;
        padding: 0 13px;
        color: #101828;
        font-size: 14px;
        outline: none;
        transition: 0.15s;
      }

      .loginForm input:focus {
        border-color: #0d5ba7;
        box-shadow:
          0 0 0 3px
          rgba(13, 91, 167, 0.09);
      }

      .passwordLabel {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
      }

      .passwordLabel button {
        border: 0;
        background: transparent;
        padding: 0;
        color: #0b5ba7;
        font-size: 10px;
        font-weight: 800;
        cursor: pointer;
      }

      .passwordField {
        position: relative;
      }

      .passwordField input {
        padding-right: 65px;
      }

      .showPassword {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        border: 0;
        background: transparent;
        color: #0b5ba7;
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
      }

      .adminLoginButton {
        width: 100%;
        min-height: 49px;
        margin-top: 3px;
        border: 0;
        border-radius: 9px;
        background:
          linear-gradient(
            135deg,
            #0a315b,
            #07599e
          );
        color: #ffffff;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        box-shadow:
          0 8px 20px
          rgba(7, 49, 91, 0.16);
      }

      .adminLoginButton:disabled,
      .passwordLabel button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .loginError {
        margin-bottom: 17px;
        padding: 11px 13px;
        border: 1px solid #f1b5af;
        border-radius: 8px;
        background: #fff3f2;
        color: #b42318;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.5;
      }

      .adminLoginNotice {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        margin-top: 22px;
        padding: 12px;
        border: 1px solid #e0e6ed;
        border-radius: 8px;
        background: #f8fafc;
      }

      .adminLoginNotice span {
        font-size: 13px;
      }

      .adminLoginNotice p {
        margin: 0;
        color: #667085;
        font-size: 10px;
        line-height: 1.5;
      }

      .backWebsite {
        display: inline-block;
        margin-top: 22px;
        color: #52647a;
        font-size: 11px;
        font-weight: 800;
        text-decoration: none;
      }

      .adminLoginLoading {
        width: 100%;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #07182d;
        color: white;
        font-size: 13px;
        font-weight: 800;
      }

      @media (max-width: 900px) {
        .adminLoginPage {
          grid-template-columns: 1fr;
        }

        .adminLoginBrand {
          min-height: auto;
        }

        .brandInner {
          min-height: auto;
          padding: 30px;
        }

        .brandContent {
          margin: 50px 0 20px;
          padding: 0;
        }

        .brandContent h1 {
          font-size: 40px;
        }

        .brandFooter {
          margin-top: 35px;
        }

        .adminLoginFormSide {
          min-height: auto;
          padding: 50px 25px 70px;
        }
      }

      @media (max-width: 500px) {
        .brandInner {
          padding: 24px 20px;
        }

        .brandContent {
          margin-top: 40px;
        }

        .brandContent h1 {
          font-size: 34px;
          letter-spacing: -1.2px;
        }

        .adminLoginFormSide {
          padding: 40px 18px 60px;
        }

        .adminLoginCard h2 {
          font-size: 27px;
        }
      }
    `}</style>
  );
}