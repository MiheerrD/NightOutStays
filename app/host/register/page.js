'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function HostRegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    city: '',
    state: 'Maharashtra',
    address: '',
    pincode: '',
    gstin: '',
    panNumber: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage('');
    setError('');

    if (!form.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!form.email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!form.phone.trim()) {
      setError('Please enter your mobile number.');
      return;
    }

    if (!form.password) {
      setError('Please create a password.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }

    if (!form.city.trim()) {
      setError('Please enter your city.');
      return;
    }

    try {
      setLoading(true);

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              full_name: form.fullName.trim(),
              account_type: 'host',
            },
          },
        });

      if (signUpError) {
        throw signUpError;
      }

      const user = signUpData?.user;

      if (!user) {
        throw new Error(
          'Host account could not be created. Please try again.'
        );
      }

      const { error: hostError } = await supabase
        .from('host_profiles')
        .insert({
          user_id: user.id,
          full_name: form.fullName.trim(),
          business_name:
            form.businessName.trim() || null,
          email: form.email.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          state: form.state.trim() || null,
          address: form.address.trim() || null,
          pincode: form.pincode.trim() || null,
          gstin: form.gstin.trim() || null,
          pan_number:
            form.panNumber.trim().toUpperCase() || null,
          status: 'pending',
        });

      if (hostError) {
        throw hostError;
      }

      setMessage(
        'Your host application has been submitted successfully. Your account is pending Super Admin approval.'
      );

      setForm({
        fullName: '',
        businessName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        city: '',
        state: 'Maharashtra',
        address: '',
        pincode: '',
        gstin: '',
        panNumber: '',
      });
    } catch (err) {
      console.error(err);

      if (
        err?.message
          ?.toLowerCase()
          .includes('already registered')
      ) {
        setError(
          'An account already exists with this email address.'
        );
      } else {
        setError(
          err?.message ||
            'Unable to submit host registration.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="header">
          <a href="/" className="brand">
            NightOutStays
          </a>

          <span className="badge">
            HOST REGISTRATION
          </span>
        </div>

        <div className="intro">
          <p className="eyebrow">
            LIST YOUR PROPERTY
          </p>

          <h1>Become a NightOutStays Host</h1>

          <p>
            Create your host account and submit your
            details for approval. Once approved, you can
            add and manage your properties.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="section">
            <h2>Host Details</h2>

            <div className="grid">
              <label>
                Full Name
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={updateField}
                  placeholder="Enter full name"
                />
              </label>

              <label>
                Business / Property Brand
                <input
                  type="text"
                  name="businessName"
                  value={form.businessName}
                  onChange={updateField}
                  placeholder="Optional"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="Email address"
                />
              </label>

              <label>
                Mobile Number
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                  placeholder="10 digit mobile number"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={updateField}
                  placeholder="Minimum 6 characters"
                />
              </label>

              <label>
                Confirm Password
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={updateField}
                  placeholder="Re-enter password"
                />
              </label>
            </div>
          </div>

          <div className="section">
            <h2>Address</h2>

            <div className="grid">
              <label className="full">
                Address
                <textarea
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  rows={3}
                  placeholder="Host correspondence address"
                />
              </label>

              <label>
                City
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={updateField}
                  placeholder="Pune"
                />
              </label>

              <label>
                State
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={updateField}
                />
              </label>

              <label>
                Pincode
                <input
                  type="text"
                  name="pincode"
                  value={form.pincode}
                  onChange={updateField}
                  placeholder="411021"
                />
              </label>
            </div>
          </div>

          <div className="section">
            <h2>Business Information</h2>

            <p className="optional">
              GSTIN and PAN can be completed now or later
              from your Host Profile.
            </p>

            <div className="grid">
              <label>
                GSTIN
                <input
                  type="text"
                  name="gstin"
                  value={form.gstin}
                  onChange={updateField}
                  placeholder="Optional"
                />
              </label>

              <label>
                PAN Number
                <input
                  type="text"
                  name="panNumber"
                  value={form.panNumber}
                  onChange={updateField}
                  placeholder="Optional"
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          {message && (
            <div className="alert success">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="submitButton"
            disabled={loading}
          >
            {loading
              ? 'Submitting...'
              : 'Submit Host Application'}
          </button>

          <div className="loginLink">
            Already registered?{' '}
            <a href="/login">
              Login here
            </a>
          </div>
        </form>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f6f7f9;
          padding: 48px 20px;
          color: #111827;
        }

        .card {
          max-width: 900px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          overflow: hidden;
        }

        .header {
          min-height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 28px;
          border-bottom: 1px solid #e5e7eb;
        }

        .brand {
          color: #0b4b8c;
          font-size: 24px;
          font-weight: 900;
          text-decoration: none;
        }

        .badge {
          background: #111827;
          color: #ffffff;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .intro {
          padding: 34px 34px 14px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #b36b00;
        }

        h1 {
          margin: 0;
          font-size: 34px;
        }

        .intro > p:last-child {
          margin: 12px 0 0;
          color: #6b7280;
          line-height: 1.6;
        }

        form {
          padding: 10px 34px 36px;
        }

        .section {
          padding: 24px 0;
          border-top: 1px solid #eef0f2;
        }

        .section:first-child {
          border-top: 0;
        }

        h2 {
          margin: 0 0 18px;
          font-size: 19px;
        }

        .optional {
          margin: -8px 0 18px;
          color: #6b7280;
          font-size: 13px;
        }

        .grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          color: #374151;
        }

        .full {
          grid-column: 1 / -1;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          padding: 12px 13px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          font-weight: 500;
          outline: none;
        }

        input:focus,
        textarea:focus {
          border-color: #111827;
          box-shadow: 0 0 0 2px
            rgba(17, 24, 39, 0.08);
        }

        textarea {
          resize: vertical;
        }

        .alert {
          margin: 10px 0 20px;
          border-radius: 10px;
          padding: 13px 15px;
          font-size: 14px;
          font-weight: 700;
        }

        .error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .success {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .submitButton {
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 14px;
          background: #111827;
          color: #ffffff;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .submitButton:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .loginLink {
          margin-top: 18px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }

        .loginLink a {
          color: #0b4b8c;
          font-weight: 800;
        }

        @media (max-width: 700px) {
          .page {
            padding: 20px 10px;
          }

          .card {
            border-radius: 12px;
          }

          .header {
            min-height: 62px;
            padding: 0 16px;
          }

          .brand {
            font-size: 20px;
          }

          .badge {
            font-size: 9px;
          }

          .intro {
            padding: 28px 20px 10px;
          }

          form {
            padding: 6px 20px 28px;
          }

          h1 {
            font-size: 28px;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .full {
            grid-column: auto;
          }
        }
      `}</style>
    </main>
  );
}