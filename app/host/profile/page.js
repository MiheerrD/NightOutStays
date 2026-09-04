'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const BANK_BUCKET = 'host-bank-documents';

const emptyForm = {
  full_name: '',
  business_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  pan_number: '',
  gstin: '',
  bank_account_name: '',
  bank_name: '',
  bank_branch: '',
  bank_account_number: '',
  confirm_bank_account_number: '',
  bank_ifsc: '',
  bank_account_type: '',
};

function text(value) {
  return String(value || '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function safeFileName(name) {
  return String(name || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

function maskAccountNumber(number) {
  const value = String(number || '').trim();

  if (!value) return '';

  if (value.length <= 4) return value;

  return `••••••••${value.slice(-4)}`;
}

export default function HostProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [user, setUser] = useState(null);
  const [host, setHost] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [bankEditMode, setBankEditMode] = useState(false);

  const [chequeFile, setChequeFile] = useState(null);
  const [chequePreview, setChequePreview] = useState('');
  const [chequePath, setChequePath] = useState('');
  const [chequeSignedUrl, setChequeSignedUrl] = useState('');

  const [savedBankSnapshot, setSavedBankSnapshot] = useState(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const bankComplete = useMemo(() => {
    return Boolean(
      text(form.bank_account_name) &&
        text(form.bank_name) &&
        text(form.bank_account_number) &&
        text(form.bank_ifsc) &&
        text(form.bank_account_type) &&
        chequePath
    );
  }, [
    form.bank_account_name,
    form.bank_name,
    form.bank_account_number,
    form.bank_ifsc,
    form.bank_account_type,
    chequePath,
  ]);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    return () => {
      if (chequePreview) {
        URL.revokeObjectURL(chequePreview);
      }
    };
  }, [chequePreview]);

  async function uploadProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setPhotoBusy(true);
    setError('');
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Login required.');
      const formData = new FormData();
      formData.append('role', 'host');
      formData.append('file', file);
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Unable to upload profile photo.');
      setHost((current) => ({ ...(current || {}), profile_photo_url: result.profilePhotoUrl }));
      setMessage('Profile photo updated successfully.');
    } catch (err) {
      setError(err?.message || 'Unable to upload profile photo.');
    } finally {
      setPhotoBusy(false);
      event.target.value = '';
    }
  }

  async function loadPage() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        router.replace('/login');
        return;
      }

      const sessionUser = session.user;
      setUser(sessionUser);

      const { data: roles, error: rolesError } = await supabase.rpc(
        'get_my_platform_roles'
      );

      if (rolesError) throw rolesError;

      const roleList = Array.isArray(roles) ? roles : [];

      const isSuperAdmin = roleList.some(
        (item) =>
          item.role === 'super_admin' &&
          (item.is_active === true || item.is_active === null)
      );

      if (isSuperAdmin) {
        router.replace('/admin');
        return;
      }

      const isHost = roleList.some(
        (item) =>
          item.role === 'host' &&
          (item.is_active === true || item.is_active === null)
      );

      if (!isHost) {
        router.replace('/account/bookings');
        return;
      }

      const { data: hostData, error: hostError } = await supabase
        .from('host_profiles')
        .select('*')
        .eq('user_id', sessionUser.id)
        .single();

      if (hostError) throw hostError;

      if (!hostData) {
        throw new Error('Host profile not found.');
      }

      if (hostData.status !== 'active') {
        throw new Error('Your host account is currently not active.');
      }

      setHost(hostData);

      const loadedForm = {
        full_name: hostData.full_name || '',
        business_name: hostData.business_name || '',
        phone: hostData.phone || '',
        email: hostData.email || sessionUser.email || '',
        address: hostData.address || '',
        city: hostData.city || '',
        state: hostData.state || '',
        pincode: hostData.pincode || '',
        pan_number: hostData.pan_number || '',
        gstin: hostData.gstin || '',
        bank_account_name: hostData.bank_account_name || '',
        bank_name: hostData.bank_name || '',
        bank_branch: hostData.bank_branch || '',
        bank_account_number: hostData.bank_account_number || '',
        confirm_bank_account_number: hostData.bank_account_number || '',
        bank_ifsc: hostData.bank_ifsc || '',
        bank_account_type: hostData.bank_account_type || '',
      };

      setForm(loadedForm);

      setSavedBankSnapshot({
        bank_account_name: loadedForm.bank_account_name,
        bank_name: loadedForm.bank_name,
        bank_branch: loadedForm.bank_branch,
        bank_account_number: loadedForm.bank_account_number,
        confirm_bank_account_number:
          loadedForm.confirm_bank_account_number,
        bank_ifsc: loadedForm.bank_ifsc,
        bank_account_type: loadedForm.bank_account_type,
      });

      const existingPath = hostData.cancelled_cheque_path || '';

      setChequePath(existingPath);

      if (existingPath) {
        await loadSignedChequeUrl(existingPath);
      }

      const hasSavedBank =
        Boolean(hostData.bank_account_name) ||
        Boolean(hostData.bank_account_number) ||
        Boolean(hostData.bank_ifsc);

      setBankEditMode(!hasSavedBank);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to load host profile.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSignedChequeUrl(path) {
    if (!path) {
      setChequeSignedUrl('');
      return;
    }

    try {
      const { data, error: signedError } = await supabase.storage
        .from(BANK_BUCKET)
        .createSignedUrl(path, 1800);

      if (signedError) {
        console.error(signedError);
        return;
      }

      setChequeSignedUrl(data?.signedUrl || '');
    } catch (err) {
      console.error(err);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;

    let nextValue = value;

    if (
      name === 'pan_number' ||
      name === 'gstin' ||
      name === 'bank_ifsc'
    ) {
      nextValue = value.toUpperCase();
    }

    if (
      name === 'bank_account_number' ||
      name === 'confirm_bank_account_number'
    ) {
      nextValue = value.replace(/\s/g, '');
    }

    setForm((current) => ({
      ...current,
      [name]: nextValue,
    }));

    setMessage('');
    setError('');
  }

  function startBankEdit() {
    setError('');
    setMessage('');

    setSavedBankSnapshot({
      bank_account_name: form.bank_account_name,
      bank_name: form.bank_name,
      bank_branch: form.bank_branch,
      bank_account_number: form.bank_account_number,
      confirm_bank_account_number: form.bank_account_number,
      bank_ifsc: form.bank_ifsc,
      bank_account_type: form.bank_account_type,
    });

    setForm((current) => ({
      ...current,
      confirm_bank_account_number:
        current.bank_account_number || '',
    }));

    setBankEditMode(true);
  }

  function cancelBankEdit() {
    if (savedBankSnapshot) {
      setForm((current) => ({
        ...current,
        ...savedBankSnapshot,
      }));
    }

    if (chequePreview) {
      URL.revokeObjectURL(chequePreview);
    }

    setChequePreview('');
    setChequeFile(null);
    setBankEditMode(false);
    setError('');
    setMessage('');
  }

  function selectCheque(event) {
    const file = event.target.files?.[0];

    setError('');
    setMessage('');

    if (!file) {
      setChequeFile(null);
      return;
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowed.includes(file.type)) {
      event.target.value = '';
      setError('Please upload JPG, PNG, WebP or PDF only.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setError('File size must be less than 5 MB.');
      return;
    }

    if (chequePreview) {
      URL.revokeObjectURL(chequePreview);
    }

    setChequeFile(file);

    if (file.type.startsWith('image/')) {
      setChequePreview(URL.createObjectURL(file));
    } else {
      setChequePreview('');
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!host?.id || !user?.id) return;

    if (!text(form.full_name)) {
      setError('Please enter your full name.');
      return;
    }

    if (!text(form.phone)) {
      setError('Please enter your contact number.');
      return;
    }

    setSavingProfile(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        full_name: text(form.full_name),
        business_name: text(form.business_name) || null,
        phone: text(form.phone),
        email: text(form.email) || user.email || null,
        address: text(form.address) || null,
        city: text(form.city) || null,
        state: text(form.state) || null,
        pincode: text(form.pincode) || null,
        pan_number: upper(form.pan_number) || null,
        gstin: upper(form.gstin) || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from('host_profiles')
        .update(payload)
        .eq('id', host.id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      setHost(data);
      setMessage('Profile details updated successfully.');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function validateBank() {
    if (!text(form.bank_account_name)) {
      return 'Please enter account holder name.';
    }

    if (!text(form.bank_name)) {
      return 'Please enter bank name.';
    }

    if (!text(form.bank_account_number)) {
      return 'Please enter account number.';
    }

    if (
      text(form.bank_account_number) !==
      text(form.confirm_bank_account_number)
    ) {
      return 'Account number and Confirm Account Number do not match.';
    }

    if (!text(form.bank_ifsc)) {
      return 'Please enter IFSC code.';
    }

    if (!text(form.bank_account_type)) {
      return 'Please select account type.';
    }

    if (!chequePath && !chequeFile) {
      return 'Please upload cancelled cheque or bank proof.';
    }

    return '';
  }

  async function uploadNewCheque() {
    if (!chequeFile) {
      return chequePath;
    }

    const extension =
      chequeFile.name.split('.').pop()?.toLowerCase() ||
      (chequeFile.type === 'application/pdf' ? 'pdf' : 'jpg');

    const fileName = safeFileName(
      `cancelled-cheque-${Date.now()}.${extension}`
    );

    const path = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BANK_BUCKET)
      .upload(path, chequeFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: chequeFile.type,
      });

    if (uploadError) throw uploadError;

    return path;
  }

  async function saveBankDetails() {
    if (!host?.id || !user?.id) return;

    const validationError = validateBank();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingBank(true);
    setError('');
    setMessage('');

    let newUploadedPath = '';

    try {
      const oldPath = chequePath;
      const finalPath = await uploadNewCheque();

      if (chequeFile && finalPath !== oldPath) {
        newUploadedPath = finalPath;
      }

      const payload = {
        bank_account_name: text(form.bank_account_name),
        bank_name: text(form.bank_name),
        bank_branch: text(form.bank_branch) || null,
        bank_account_number: text(form.bank_account_number),
        bank_ifsc: upper(form.bank_ifsc),
        bank_account_type: text(form.bank_account_type),
        cancelled_cheque_path: finalPath,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from('host_profiles')
        .update(payload)
        .eq('id', host.id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      if (chequeFile && oldPath && oldPath !== finalPath) {
        try {
          await supabase.storage.from(BANK_BUCKET).remove([oldPath]);
        } catch (removeError) {
          console.error(removeError);
        }
      }

      setHost(data);
      setChequePath(finalPath);

      if (finalPath) {
        await loadSignedChequeUrl(finalPath);
      }

      if (chequePreview) {
        URL.revokeObjectURL(chequePreview);
      }

      setChequePreview('');
      setChequeFile(null);

      setForm((current) => ({
        ...current,
        confirm_bank_account_number:
          data.bank_account_number || '',
      }));

      setSavedBankSnapshot({
        bank_account_name: data.bank_account_name || '',
        bank_name: data.bank_name || '',
        bank_branch: data.bank_branch || '',
        bank_account_number: data.bank_account_number || '',
        confirm_bank_account_number:
          data.bank_account_number || '',
        bank_ifsc: data.bank_ifsc || '',
        bank_account_type: data.bank_account_type || '',
      });

      setBankEditMode(false);
      setMessage('Bank details updated successfully.');
    } catch (err) {
      console.error(err);

      if (newUploadedPath) {
        try {
          await supabase.storage
            .from(BANK_BUCKET)
            .remove([newUploadedPath]);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }

      setError(err?.message || 'Unable to update bank details.');
    } finally {
      setSavingBank(false);
    }
  }

  if (loading) {
    return (
      <main className="nosProfileLoading">
        <div className="nosProfileSpinner" />
        <p>Loading profile...</p>

        <style jsx global>{`
          .nosProfileLoading {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            font-family: Arial, sans-serif;
            color: #17233a;
            background: #f5f7fa;
          }

          .nosProfileSpinner {
            width: 38px;
            height: 38px;
            border: 4px solid #dfe4eb;
            border-top-color: #17233a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="nosProfilePage">
      <div className="nosProfileShell">
        <div className="nosProfileHeader">
          <div>
            <div className="nosProfileEyebrow">HOST ACCOUNT</div>
            <h1>My Profile</h1>
            <p>
              Manage your personal, business and bank information.
            </p>
          </div>

          <a href="/host" className="nosProfileBack">
            Back to Dashboard
          </a>
        </div>

        {error ? (
          <div className="nosProfileAlert error">{error}</div>
        ) : null}

        {message ? (
          <div className="nosProfileAlert success">{message}</div>
        ) : null}

        <div className="nosProfileLayout">
          <div className="nosProfileMain">
            <section className="nosProfileCard nosProfileAvatarCard">
              <div className="nosProfileAvatar">
                {host?.profile_photo_url ? <img src={host.profile_photo_url} alt="Host profile" /> : <span>{(host?.full_name || host?.business_name || 'H').slice(0,1).toUpperCase()}</span>}
              </div>
              <div className="nosProfileAvatarInfo">
                <h2>Profile Photo & Identity</h2>
                <p>Your photo is shown to Guests in booking conversations.</p>
                <div className="nosProfileAvatarActions">
                  <label className="nosProfilePhotoButton">{photoBusy ? 'Uploading...' : 'Upload Photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProfilePhoto} disabled={photoBusy} /></label>
                  <a href="/host/verification" className="nosProfileVerifyLink">Verify Identity</a>
                  <span className="nosProfileVerifyStatus">{String(host?.identity_verification_status || 'not submitted').replace('_',' ')}</span>
                </div>
              </div>
            </section>
            <form onSubmit={saveProfile}>
              <section className="nosProfileCard">
                <div className="nosProfileCardTitle">
                  <div>
                    <h2>Host Information</h2>
                    <p>Your primary contact and business details.</p>
                  </div>

                  <span className="nosProfileStatus">
                    {host?.status || 'Host'}
                  </span>
                </div>

                <div className="nosProfileGrid2">
                  <label className="nosProfileField">
                    <span>Full Name *</span>
                    <input
                      name="full_name"
                      value={form.full_name}
                      onChange={updateField}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Business / Brand Name</span>
                    <input
                      name="business_name"
                      value={form.business_name}
                      onChange={updateField}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Contact Number *</span>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={updateField}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Email</span>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={updateField}
                    />
                  </label>
                </div>
              </section>

              <section className="nosProfileCard">
                <div className="nosProfileCardTitle">
                  <div>
                    <h2>Address</h2>
                    <p>Your correspondence address.</p>
                  </div>
                </div>

                <div className="nosProfileGrid2">
                  <label className="nosProfileField full">
                    <span>Address</span>
                    <textarea
                      rows={3}
                      name="address"
                      value={form.address}
                      onChange={updateField}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>City</span>
                    <input
                      name="city"
                      value={form.city}
                      onChange={updateField}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>State</span>
                    <input
                      name="state"
                      value={form.state}
                      onChange={updateField}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Pincode</span>
                    <input
                      name="pincode"
                      value={form.pincode}
                      onChange={updateField}
                    />
                  </label>
                </div>
              </section>

              <section className="nosProfileCard">
                <div className="nosProfileCardTitle">
                  <div>
                    <h2>Tax Information</h2>
                    <p>PAN and optional GST details.</p>
                  </div>
                </div>

                <div className="nosProfileGrid2">
                  <label className="nosProfileField">
                    <span>PAN Number</span>
                    <input
                      name="pan_number"
                      value={form.pan_number}
                      onChange={updateField}
                      maxLength={10}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>GSTIN Optional</span>
                    <input
                      name="gstin"
                      value={form.gstin}
                      onChange={updateField}
                      maxLength={15}
                    />
                  </label>
                </div>

                <div className="nosProfileProfileActions">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="nosProfilePrimary"
                  >
                    {savingProfile
                      ? 'Saving...'
                      : 'Save Profile Details'}
                  </button>
                </div>
              </section>
            </form>

            <section className="nosProfileCard nosProfileBankCard">
              <div className="nosProfileCardTitle">
                <div>
                  <div className="nosProfileEyebrow">
                    SETTLEMENT INFORMATION
                  </div>
                  <h2>Bank Details</h2>
                  <p>
                    Bank details are kept private and are not shown to
                    guests.
                  </p>
                </div>

                <div className="nosProfileBankHeaderActions">
                  <span
                    className={
                      bankComplete
                        ? 'nosProfileCompleteBadge'
                        : 'nosProfileIncompleteBadge'
                    }
                  >
                    {bankComplete ? 'Complete' : 'Incomplete'}
                  </span>

                  {!bankEditMode ? (
                    <button
                      type="button"
                      className="nosProfileEditBank"
                      onClick={startBankEdit}
                    >
                      Update Bank Details
                    </button>
                  ) : null}
                </div>
              </div>

              {!bankEditMode ? (
                <div className="nosProfileBankSummary">
                  <div>
                    <span>Account Holder</span>
                    <strong>
                      {form.bank_account_name || 'Not added'}
                    </strong>
                  </div>

                  <div>
                    <span>Bank Name</span>
                    <strong>{form.bank_name || 'Not added'}</strong>
                  </div>

                  <div>
                    <span>Branch</span>
                    <strong>
                      {form.bank_branch || 'Not added'}
                    </strong>
                  </div>

                  <div>
                    <span>Account Number</span>
                    <strong>
                      {form.bank_account_number
                        ? maskAccountNumber(
                            form.bank_account_number
                          )
                        : 'Not added'}
                    </strong>
                  </div>

                  <div>
                    <span>IFSC Code</span>
                    <strong>{form.bank_ifsc || 'Not added'}</strong>
                  </div>

                  <div>
                    <span>Account Type</span>
                    <strong>
                      {form.bank_account_type
                        ? form.bank_account_type === 'savings'
                          ? 'Savings Account'
                          : 'Current Account'
                        : 'Not added'}
                    </strong>
                  </div>
                </div>
              ) : (
                <>
                  <div className="nosProfileSecurity">
                    You are editing sensitive bank information. Please
                    verify the account number and IFSC carefully before
                    saving.
                  </div>

                  <div className="nosProfileGrid2">
                    <label className="nosProfileField full">
                      <span>Account Holder Name *</span>
                      <input
                        name="bank_account_name"
                        value={form.bank_account_name}
                        onChange={updateField}
                        placeholder="Name as per bank account"
                      />
                    </label>

                    <label className="nosProfileField">
                      <span>Bank Name *</span>
                      <input
                        name="bank_name"
                        value={form.bank_name}
                        onChange={updateField}
                      />
                    </label>

                    <label className="nosProfileField">
                      <span>Branch Name</span>
                      <input
                        name="bank_branch"
                        value={form.bank_branch}
                        onChange={updateField}
                      />
                    </label>

                    <label className="nosProfileField">
                      <span>Account Type *</span>
                      <select
                        name="bank_account_type"
                        value={form.bank_account_type}
                        onChange={updateField}
                      >
                        <option value="">
                          Select account type
                        </option>
                        <option value="savings">
                          Savings Account
                        </option>
                        <option value="current">
                          Current Account
                        </option>
                      </select>
                    </label>

                    <label className="nosProfileField">
                      <span>IFSC Code *</span>
                      <input
                        name="bank_ifsc"
                        value={form.bank_ifsc}
                        onChange={updateField}
                        maxLength={11}
                      />
                    </label>

                    <label className="nosProfileField">
                      <span>Account Number *</span>
                      <input
                        type="password"
                        name="bank_account_number"
                        value={form.bank_account_number}
                        onChange={updateField}
                        autoComplete="off"
                      />
                    </label>

                    <label className="nosProfileField">
                      <span>Confirm Account Number *</span>
                      <input
                        name="confirm_bank_account_number"
                        value={form.confirm_bank_account_number}
                        onChange={updateField}
                        autoComplete="off"
                      />
                    </label>
                  </div>

                  <div className="nosProfileCheque">
                    <div>
                      <h3>Cancelled Cheque / Bank Proof</h3>
                      <p>
                        Upload only if adding or replacing the current
                        bank proof.
                      </p>
                    </div>

                    <label className="nosProfileUpload">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        onChange={selectCheque}
                      />

                      <strong>
                        {chequeFile
                          ? chequeFile.name
                          : chequePath
                          ? 'Choose a new document to replace existing'
                          : 'Choose cancelled cheque / bank proof'}
                      </strong>

                      <span>
                        JPG, PNG, WebP or PDF. Maximum 5 MB.
                      </span>
                    </label>

                    {chequePreview ? (
                      <div className="nosProfilePreview">
                        <img
                          src={chequePreview}
                          alt="Bank document preview"
                        />
                        <div>
                          <strong>New document selected</strong>
                          <span>
                            This will replace the current document after
                            saving.
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {chequePath && !chequeFile ? (
                      <div className="nosProfileExisting">
                        <div>
                          <strong>
                            Existing bank document is on file
                          </strong>
                          <span>
                            You do not need to upload it again.
                          </span>
                        </div>

                        {chequeSignedUrl ? (
                          <a
                            href={chequeSignedUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Document
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="nosProfileBankActions">
                    {savedBankSnapshot ? (
                      <button
                        type="button"
                        className="nosProfileSecondary"
                        onClick={cancelBankEdit}
                        disabled={savingBank}
                      >
                        Cancel
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="nosProfilePrimary"
                      onClick={saveBankDetails}
                      disabled={savingBank}
                    >
                      {savingBank
                        ? 'Saving Bank Details...'
                        : bankComplete
                        ? 'Save Updated Bank Details'
                        : 'Save Bank Details'}
                    </button>
                  </div>
                </>
              )}

              {!bankEditMode && chequePath ? (
                <div className="nosProfileExisting nosProfileDocumentRow">
                  <div>
                    <strong>Cancelled cheque / bank proof</strong>
                    <span>Private document stored securely.</span>
                  </div>

                  {chequeSignedUrl ? (
                    <a
                      href={chequeSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Document
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="nosProfileSide">
            <section className="nosProfileSideCard">
              <div className="nosProfileAvatar">
                {(form.business_name ||
                  form.full_name ||
                  'H')
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <h3>
                {form.business_name ||
                  form.full_name ||
                  'Host'}
              </h3>

              <p>{form.email || user?.email}</p>

              <div className="nosProfileDivider" />

              <div className="nosProfileSideRow">
                <span>Host Status</span>
                <strong className="green">
                  {host?.status || '-'}
                </strong>
              </div>

              <div className="nosProfileSideRow">
                <span>Bank Details</span>
                <strong
                  className={
                    bankComplete ? 'green' : 'orange'
                  }
                >
                  {bankComplete ? 'Complete' : 'Incomplete'}
                </strong>
              </div>
            </section>

            <section className="nosProfileSideCard">
              <h3>Bank Details Checklist</h3>

              <div className="nosProfileChecklist">
                <div className={form.bank_account_name ? 'done' : ''}>
                  <span>✓</span>
                  Account holder name
                </div>

                <div className={form.bank_name ? 'done' : ''}>
                  <span>✓</span>
                  Bank name
                </div>

                <div
                  className={
                    form.bank_account_number ? 'done' : ''
                  }
                >
                  <span>✓</span>
                  Account number
                </div>

                <div className={form.bank_ifsc ? 'done' : ''}>
                  <span>✓</span>
                  IFSC
                </div>

                <div
                  className={
                    form.bank_account_type ? 'done' : ''
                  }
                >
                  <span>✓</span>
                  Account type
                </div>

                <div className={chequePath ? 'done' : ''}>
                  <span>✓</span>
                  Bank proof
                </div>
              </div>
            </section>

            <section className="nosProfileSideCard dark">
              <h3>Settlement Information</h3>
              <p>
                Automatic host payouts are not enabled in this phase.
                These bank details will be used for manual settlement
                records.
              </p>
            </section>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .nosProfilePage {
          min-height: 100vh;
          padding: 34px 0 70px;
          background: #f5f7fa;
          color: #172033;
          font-family: Arial, Helvetica, sans-serif;
        }

        .nosProfileShell {
          width: min(1450px, calc(100% - 48px));
          margin: 0 auto;
        }

        .nosProfileHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 26px;
        }

        .nosProfileEyebrow {
          color: #a27b2e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        .nosProfileHeader h1 {
          margin: 5px 0 7px;
          font-size: 34px;
          color: #17233a;
        }

        .nosProfileHeader p {
          margin: 0;
          color: #697386;
          font-size: 14px;
        }

        .nosProfileBack {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 17px;
          border: 1px solid #d9dfe8;
          border-radius: 9px;
          background: white;
          color: #17233a;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .nosProfileAlert {
          margin-bottom: 20px;
          padding: 13px 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
        }

        .nosProfileAlert.error {
          background: #fff0f0;
          border: 1px solid #f2b4b4;
          color: #a42b2b;
        }

        .nosProfileAlert.success {
          background: #edf9f0;
          border: 1px solid #afe0ba;
          color: #216c35;
        }

        .nosProfileLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 24px;
          align-items: start;
        }

        .nosProfileMain {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .nosProfileCard,
        .nosProfileSideCard {
          background: #fff;
          border: 1px solid #e1e6ed;
          border-radius: 15px;
          box-shadow: 0 3px 12px rgba(25, 35, 50, 0.04);
        }

        .nosProfileCard {
          padding: 24px;
        }

        .nosProfileBankCard {
          border-top: 4px solid #aa8439;
        }

        .nosProfileCardTitle {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 21px;
        }

        .nosProfileCardTitle h2 {
          margin: 4px 0 6px;
          color: #17233a;
          font-size: 20px;
        }

        .nosProfileCardTitle p {
          margin: 0;
          color: #697386;
          font-size: 12px;
          line-height: 1.5;
        }

        .nosProfileStatus,
        .nosProfileCompleteBadge,
        .nosProfileIncompleteBadge {
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .nosProfileStatus,
        .nosProfileCompleteBadge {
          background: #e8f7ec;
          color: #28713b;
        }

        .nosProfileIncompleteBadge {
          background: #fff3dd;
          color: #9e6816;
        }

        .nosProfileGrid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .nosProfileField {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .nosProfileField.full {
          grid-column: 1 / -1;
        }

        .nosProfileField span {
          font-size: 12px;
          font-weight: 800;
          color: #344054;
        }

        .nosProfileField input,
        .nosProfileField select,
        .nosProfileField textarea {
          width: 100%;
          border: 1px solid #d7dde6;
          border-radius: 9px;
          background: #fff;
          color: #172033;
          outline: none;
          font: inherit;
          font-size: 14px;
        }

        .nosProfileField input,
        .nosProfileField select {
          height: 45px;
          padding: 0 13px;
        }

        .nosProfileField textarea {
          padding: 12px 13px;
          resize: vertical;
        }

        .nosProfileField input:focus,
        .nosProfileField select:focus,
        .nosProfileField textarea:focus {
          border-color: #9d7a35;
          box-shadow: 0 0 0 3px rgba(157, 122, 53, 0.1);
        }

        .nosProfileProfileActions,
        .nosProfileBankActions {
          margin-top: 22px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .nosProfilePrimary,
        .nosProfileSecondary,
        .nosProfileEditBank {
          min-height: 44px;
          padding: 0 18px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .nosProfilePrimary {
          border: 0;
          background: #17233a;
          color: white;
        }

        .nosProfilePrimary:hover {
          background: #243753;
        }

        .nosProfileSecondary {
          border: 1px solid #d7dde5;
          background: white;
          color: #344054;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .nosProfileBankHeaderActions {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .nosProfileEditBank {
          border: 1px solid #17233a;
          background: #fff;
          color: #17233a;
        }

        .nosProfileEditBank:hover {
          background: #17233a;
          color: #fff;
        }

        .nosProfileBankSummary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .nosProfileBankSummary > div {
          padding: 15px;
          border: 1px solid #e4e8ee;
          border-radius: 10px;
          background: #fafbfc;
        }

        .nosProfileBankSummary span,
        .nosProfileBankSummary strong {
          display: block;
        }

        .nosProfileBankSummary span {
          margin-bottom: 7px;
          color: #7a8391;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .nosProfileBankSummary strong {
          color: #273148;
          font-size: 13px;
        }

        .nosProfileSecurity {
          margin-bottom: 20px;
          padding: 12px 14px;
          border-radius: 9px;
          background: #fff7e8;
          color: #715421;
          font-size: 12px;
          line-height: 1.5;
        }

        .nosProfileCheque {
          margin-top: 24px;
          padding-top: 22px;
          border-top: 1px solid #e7eaf0;
        }

        .nosProfileCheque h3 {
          margin: 0 0 5px;
          font-size: 14px;
          color: #17233a;
        }

        .nosProfileCheque p {
          margin: 0 0 14px;
          color: #747d8b;
          font-size: 12px;
        }

        .nosProfileUpload {
          min-height: 95px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border: 1.5px dashed #c9d0db;
          border-radius: 11px;
          background: #fafbfc;
          cursor: pointer;
        }

        .nosProfileUpload:hover {
          border-color: #aa853e;
          background: #fdfbf7;
        }

        .nosProfileUpload input {
          display: none;
        }

        .nosProfileUpload strong {
          margin-bottom: 5px;
          color: #283249;
          font-size: 12px;
        }

        .nosProfileUpload span {
          color: #7b8492;
          font-size: 11px;
        }

        .nosProfilePreview,
        .nosProfileExisting {
          margin-top: 13px;
          padding: 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border: 1px solid #e2e7ed;
          border-radius: 9px;
          background: #fff;
        }

        .nosProfilePreview {
          justify-content: flex-start;
        }

        .nosProfilePreview img {
          width: 90px;
          height: 65px;
          object-fit: cover;
          border-radius: 7px;
          border: 1px solid #e1e5eb;
        }

        .nosProfilePreview strong,
        .nosProfilePreview span,
        .nosProfileExisting strong,
        .nosProfileExisting span {
          display: block;
        }

        .nosProfilePreview strong,
        .nosProfileExisting strong {
          margin-bottom: 4px;
          color: #273148;
          font-size: 12px;
        }

        .nosProfilePreview span,
        .nosProfileExisting span {
          color: #78818e;
          font-size: 11px;
        }

        .nosProfileExisting a {
          color: #8d6c2d;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
        }

        .nosProfileDocumentRow {
          margin-top: 20px;
        }

        .nosProfileSide {
          display: flex;
          flex-direction: column;
          gap: 18px;
          position: sticky;
          top: 24px;
        }

        .nosProfileSideCard {
          padding: 21px;
        }

        .nosProfileAvatar {
          width: 57px;
          height: 57px;
          margin-bottom: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #17233a;
          color: #d6b465;
          font-size: 23px;
          font-weight: 800;
        }

        .nosProfileSideCard h3 {
          margin: 0 0 9px;
          font-size: 15px;
          color: #17233a;
        }

        .nosProfileSideCard > p {
          margin: 0;
          color: #7b8492;
          font-size: 12px;
          line-height: 1.6;
          word-break: break-word;
        }

        .nosProfileDivider {
          height: 1px;
          margin: 17px 0;
          background: #e7eaf0;
        }

        .nosProfileSideRow {
          padding: 7px 0;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
        }

        .nosProfileSideRow span {
          color: #78818e;
        }

        .nosProfileSideRow strong {
          text-transform: capitalize;
        }

        .green {
          color: #26713a;
        }

        .orange {
          color: #a26813;
        }

        .nosProfileChecklist {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .nosProfileChecklist div {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #7a8391;
          font-size: 12px;
        }

        .nosProfileChecklist div span {
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #eef0f3;
          color: #a5acb6;
          font-size: 10px;
          font-weight: 900;
        }

        .nosProfileChecklist div.done {
          color: #315d3b;
        }

        .nosProfileChecklist div.done span {
          background: #e7f6eb;
          color: #2c7840;
        }

        .nosProfileSideCard.dark {
          background: #17233a;
          border-color: #17233a;
        }

        .nosProfileSideCard.dark h3 {
          color: #fff;
        }

        .nosProfileSideCard.dark p {
          color: #cbd3de;
        }

        @media (max-width: 1000px) {
          .nosProfileLayout {
            grid-template-columns: 1fr;
          }

          .nosProfileSide {
            position: static;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .nosProfileSideCard.dark {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .nosProfileShell {
            width: calc(100% - 28px);
          }

          .nosProfileHeader {
            flex-direction: column;
          }

          .nosProfileHeader h1 {
            font-size: 28px;
          }

          .nosProfileGrid2,
          .nosProfileBankSummary,
          .nosProfileSide {
            grid-template-columns: 1fr;
          }

          .nosProfileCard {
            padding: 19px;
          }

          .nosProfileCardTitle {
            flex-direction: column;
          }

          .nosProfileBankHeaderActions {
            justify-content: flex-start;
          }

          .nosProfileProfileActions,
          .nosProfileBankActions {
            flex-direction: column-reverse;
          }

          .nosProfilePrimary,
          .nosProfileSecondary,
          .nosProfileEditBank {
            width: 100%;
          }

          .nosProfileExisting {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      .nosProfileAvatarCard{display:flex!important;align-items:center;gap:18px}.nosProfileAvatar{width:84px;height:84px;flex:0 0 84px;border-radius:50%;overflow:hidden;background:#303a44;color:#fff;display:grid;place-items:center;font-size:30px;font-weight:900}.nosProfileAvatar img{width:100%;height:100%;object-fit:cover}.nosProfileAvatarInfo h2{margin:0 0 5px}.nosProfileAvatarInfo p{margin:0 0 10px;color:#667085;font-size:12px}.nosProfileAvatarActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.nosProfilePhotoButton,.nosProfileVerifyLink{display:inline-flex;align-items:center;min-height:36px;border-radius:999px;padding:0 12px;font-size:10px;font-weight:900;cursor:pointer;text-decoration:none}.nosProfilePhotoButton{background:#303a44;color:#fff}.nosProfilePhotoButton input{display:none}.nosProfileVerifyLink{background:#f00078;color:#fff}.nosProfileVerifyStatus{text-transform:capitalize;font-size:10px;color:#667085;font-weight:800}@media(max-width:560px){.nosProfileAvatarCard{align-items:flex-start!important}.nosProfileAvatar{width:64px;height:64px;flex-basis:64px}.nosProfileAvatarActions{gap:6px}}`}</style>
    </main>
  );
}