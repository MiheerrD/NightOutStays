'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const BANK_DOCUMENT_BUCKET = 'host-bank-documents';

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

function cleanText(value) {
  return String(value || '').trim();
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function safeFileName(fileName) {
  const name = String(fileName || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');

  return name || 'document';
}

function maskAccountNumber(number) {
  const value = String(number || '').trim();

  if (!value) return '';

  if (value.length <= 4) return value;

  return `${'•'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
}

export default function HostProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCheque, setUploadingCheque] = useState(false);

  const [user, setUser] = useState(null);
  const [host, setHost] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [chequeFile, setChequeFile] = useState(null);
  const [chequePreviewUrl, setChequePreviewUrl] = useState('');
  const [existingChequePath, setExistingChequePath] = useState('');
  const [existingChequeUrl, setExistingChequeUrl] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const bankDetailsComplete = useMemo(() => {
    return Boolean(
      cleanText(form.bank_account_name) &&
        cleanText(form.bank_name) &&
        cleanText(form.bank_account_number) &&
        cleanText(form.bank_ifsc) &&
        cleanText(form.bank_account_type) &&
        existingChequePath
    );
  }, [
    form.bank_account_name,
    form.bank_name,
    form.bank_account_number,
    form.bank_ifsc,
    form.bank_account_type,
    existingChequePath,
  ]);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    return () => {
      if (chequePreviewUrl) {
        URL.revokeObjectURL(chequePreviewUrl);
      }
    };
  }, [chequePreviewUrl]);

  async function loadPage() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        router.replace('/login');
        return;
      }

      const sessionUser = session.user;
      setUser(sessionUser);

      const { data: roles, error: rolesError } = await supabase.rpc(
        'get_my_platform_roles'
      );

      if (rolesError) {
        throw rolesError;
      }

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

      if (hostError) {
        throw hostError;
      }

      if (!hostData) {
        throw new Error('Host profile not found.');
      }

      if (hostData.status !== 'active') {
        throw new Error(
          'Your host account is currently not active. Please contact NightOutStays.'
        );
      }

      setHost(hostData);

      setForm({
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
      });

      const chequePath = hostData.cancelled_cheque_path || '';

      setExistingChequePath(chequePath);

      if (chequePath) {
        await createChequeSignedUrl(chequePath);
      }
    } catch (err) {
      console.error('Host profile load error:', err);
      setError(err?.message || 'Unable to load host profile.');
    } finally {
      setLoading(false);
    }
  }

  async function createChequeSignedUrl(path) {
    if (!path) {
      setExistingChequeUrl('');
      return;
    }

    try {
      const { data, error: signedError } = await supabase.storage
        .from(BANK_DOCUMENT_BUCKET)
        .createSignedUrl(path, 60 * 30);

      if (signedError) {
        console.error('Cheque signed URL error:', signedError);
        setExistingChequeUrl('');
        return;
      }

      setExistingChequeUrl(data?.signedUrl || '');
    } catch (err) {
      console.error('Cheque preview error:', err);
      setExistingChequeUrl('');
    }
  }

  function updateField(event) {
    const { name, value } = event.target;

    let nextValue = value;

    if (name === 'bank_ifsc' || name === 'pan_number' || name === 'gstin') {
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

  function handleChequeSelection(event) {
    const file = event.target.files?.[0];

    setMessage('');
    setError('');

    if (!file) {
      setChequeFile(null);

      if (chequePreviewUrl) {
        URL.revokeObjectURL(chequePreviewUrl);
      }

      setChequePreviewUrl('');
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      event.target.value = '';
      setError('Please upload JPG, PNG, WebP or PDF only.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setError('Cancelled cheque or bank proof must be smaller than 5 MB.');
      return;
    }

    if (chequePreviewUrl) {
      URL.revokeObjectURL(chequePreviewUrl);
    }

    setChequeFile(file);

    if (file.type.startsWith('image/')) {
      setChequePreviewUrl(URL.createObjectURL(file));
    } else {
      setChequePreviewUrl('');
    }
  }

  function validateForm() {
    if (!cleanText(form.full_name)) {
      return 'Please enter your full name.';
    }

    if (!cleanText(form.phone)) {
      return 'Please enter your contact number.';
    }

    if (!cleanText(form.bank_account_name)) {
      return 'Please enter the account holder name.';
    }

    if (!cleanText(form.bank_name)) {
      return 'Please enter the bank name.';
    }

    if (!cleanText(form.bank_account_number)) {
      return 'Please enter the bank account number.';
    }

    if (
      cleanText(form.bank_account_number) !==
      cleanText(form.confirm_bank_account_number)
    ) {
      return 'Bank account number and confirmation do not match.';
    }

    if (!cleanText(form.bank_ifsc)) {
      return 'Please enter the IFSC code.';
    }

    if (!cleanText(form.bank_account_type)) {
      return 'Please select the account type.';
    }

    if (!existingChequePath && !chequeFile) {
      return 'Please upload a cancelled cheque or bank proof.';
    }

    return '';
  }

  async function uploadChequeIfRequired() {
    if (!chequeFile) {
      return existingChequePath;
    }

    if (!user?.id) {
      throw new Error('User session not found.');
    }

    setUploadingCheque(true);

    try {
      const extension =
        chequeFile.name.split('.').pop()?.toLowerCase() ||
        (chequeFile.type === 'application/pdf' ? 'pdf' : 'jpg');

      const fileName = safeFileName(
        `cancelled-cheque-${Date.now()}.${extension}`
      );

      const storagePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BANK_DOCUMENT_BUCKET)
        .upload(storagePath, chequeFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: chequeFile.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      return storagePath;
    } finally {
      setUploadingCheque(false);
    }
  }

  async function deleteOldChequeIfReplaced(oldPath, newPath) {
    if (!oldPath || !newPath || oldPath === newPath) {
      return;
    }

    try {
      const { error: removeError } = await supabase.storage
        .from(BANK_DOCUMENT_BUCKET)
        .remove([oldPath]);

      if (removeError) {
        console.error('Old cheque removal error:', removeError);
      }
    } catch (err) {
      console.error('Old cheque removal error:', err);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!host?.id || !user?.id) {
      setError('Host profile is not ready. Please refresh the page.');
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setMessage('');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    let newlyUploadedPath = '';

    try {
      const oldChequePath = existingChequePath;

      const finalChequePath = await uploadChequeIfRequired();

      if (chequeFile && finalChequePath !== oldChequePath) {
        newlyUploadedPath = finalChequePath;
      }

      const updatePayload = {
        full_name: cleanText(form.full_name),
        business_name: cleanText(form.business_name) || null,
        phone: cleanText(form.phone),
        email: cleanText(form.email) || user.email || null,
        address: cleanText(form.address) || null,
        city: cleanText(form.city) || null,
        state: cleanText(form.state) || null,
        pincode: cleanText(form.pincode) || null,

        pan_number: cleanUpper(form.pan_number) || null,
        gstin: cleanUpper(form.gstin) || null,

        bank_account_name: cleanText(form.bank_account_name),
        bank_name: cleanText(form.bank_name),
        bank_branch: cleanText(form.bank_branch) || null,
        bank_account_number: cleanText(form.bank_account_number),
        bank_ifsc: cleanUpper(form.bank_ifsc),
        bank_account_type: cleanText(form.bank_account_type),
        cancelled_cheque_path: finalChequePath,

        updated_at: new Date().toISOString(),
      };

      const { data: updatedHost, error: updateError } = await supabase
        .from('host_profiles')
        .update(updatePayload)
        .eq('id', host.id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      setHost(updatedHost);
      setExistingChequePath(finalChequePath);

      if (finalChequePath) {
        await createChequeSignedUrl(finalChequePath);
      }

      if (chequeFile && oldChequePath && oldChequePath !== finalChequePath) {
        await deleteOldChequeIfReplaced(oldChequePath, finalChequePath);
      }

      setChequeFile(null);

      if (chequePreviewUrl) {
        URL.revokeObjectURL(chequePreviewUrl);
      }

      setChequePreviewUrl('');

      setForm((current) => ({
        ...current,
        bank_account_number: updatedHost.bank_account_number || '',
        confirm_bank_account_number:
          updatedHost.bank_account_number || '',
      }));

      setMessage('Profile and bank details saved successfully.');
    } catch (err) {
      console.error('Profile save error:', err);

      if (newlyUploadedPath) {
        try {
          await supabase.storage
            .from(BANK_DOCUMENT_BUCKET)
            .remove([newlyUploadedPath]);
        } catch (cleanupError) {
          console.error('Upload cleanup error:', cleanupError);
        }
      }

      setError(err?.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
      setUploadingCheque(false);
    }
  }

  if (loading) {
    return (
      <main className="nosProfileLoading">
        <div className="nosProfileLoader" />
        <p>Loading your profile...</p>

        <style jsx global>{`
          .nosProfileLoading {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background: #f7f8fb;
            color: #15233b;
            font-family: Arial, Helvetica, sans-serif;
          }

          .nosProfileLoader {
            width: 38px;
            height: 38px;
            border: 4px solid #dfe4ec;
            border-top-color: #15233b;
            border-radius: 50%;
            animation: nosProfileSpin 0.8s linear infinite;
          }

          @keyframes nosProfileSpin {
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
        <div className="nosProfileTop">
          <div>
            <div className="nosProfileEyebrow">HOST ACCOUNT</div>
            <h1>My Profile</h1>
            <p>
              Manage your contact, business and bank account details.
            </p>
          </div>

          <a href="/host" className="nosProfileBack">
            Back to Dashboard
          </a>
        </div>

        {error ? (
          <div className="nosProfileAlert nosProfileError">{error}</div>
        ) : null}

        {message ? (
          <div className="nosProfileAlert nosProfileSuccess">
            {message}
          </div>
        ) : null}

        <form onSubmit={saveProfile}>
          <div className="nosProfileLayout">
            <div className="nosProfileMain">
              <section className="nosProfileCard">
                <div className="nosProfileCardHeader">
                  <div>
                    <h2>Host Information</h2>
                    <p>Your primary NightOutStays host details.</p>
                  </div>

                  <span
                    className={`nosProfileStatus ${
                      host?.status === 'active'
                        ? 'nosProfileStatusActive'
                        : ''
                    }`}
                  >
                    {host?.status || 'Host'}
                  </span>
                </div>

                <div className="nosProfileGrid2">
                  <label className="nosProfileField">
                    <span>
                      Full Name <b>*</b>
                    </span>
                    <input
                      type="text"
                      name="full_name"
                      value={form.full_name}
                      onChange={updateField}
                      placeholder="Host full name"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Business / Property Brand Name</span>
                    <input
                      type="text"
                      name="business_name"
                      value={form.business_name}
                      onChange={updateField}
                      placeholder="Example: Aanandee Realty"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>
                      Contact Number <b>*</b>
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={updateField}
                      placeholder="Mobile number"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Email</span>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={updateField}
                      placeholder="Email address"
                    />
                  </label>
                </div>
              </section>

              <section className="nosProfileCard">
                <div className="nosProfileCardHeader">
                  <div>
                    <h2>Address</h2>
                    <p>Host or business correspondence address.</p>
                  </div>
                </div>

                <div className="nosProfileGrid2">
                  <label className="nosProfileField nosProfileFull">
                    <span>Address</span>
                    <textarea
                      name="address"
                      value={form.address}
                      onChange={updateField}
                      rows={3}
                      placeholder="Complete address"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>City</span>
                    <input
                      type="text"
                      name="city"
                      value={form.city}
                      onChange={updateField}
                      placeholder="City"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>State</span>
                    <input
                      type="text"
                      name="state"
                      value={form.state}
                      onChange={updateField}
                      placeholder="State"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Pincode</span>
                    <input
                      type="text"
                      name="pincode"
                      value={form.pincode}
                      onChange={updateField}
                      placeholder="Pincode"
                    />
                  </label>
                </div>
              </section>

              <section className="nosProfileCard">
                <div className="nosProfileCardHeader">
                  <div>
                    <h2>Tax Information</h2>
                    <p>
                      Keep PAN on record. GSTIN can be added where
                      applicable.
                    </p>
                  </div>
                </div>

                <div className="nosProfileGrid2">
                  <label className="nosProfileField">
                    <span>PAN Number</span>
                    <input
                      type="text"
                      name="pan_number"
                      value={form.pan_number}
                      onChange={updateField}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>GSTIN Optional</span>
                    <input
                      type="text"
                      name="gstin"
                      value={form.gstin}
                      onChange={updateField}
                      placeholder="GST registration number"
                      maxLength={15}
                    />
                  </label>
                </div>
              </section>

              <section className="nosProfileCard nosProfileBankCard">
                <div className="nosProfileCardHeader">
                  <div>
                    <div className="nosProfileSectionLabel">
                      MANUAL SETTLEMENT DETAILS
                    </div>
                    <h2>Bank Account Details</h2>
                    <p>
                      These details will be used by NightOutStays for
                      manual settlement of booking amounts.
                    </p>
                  </div>

                  <span
                    className={`nosProfileBankBadge ${
                      bankDetailsComplete
                        ? 'nosProfileComplete'
                        : 'nosProfileIncomplete'
                    }`}
                  >
                    {bankDetailsComplete ? 'Complete' : 'Incomplete'}
                  </span>
                </div>

                <div className="nosProfileSecurityNote">
                  Bank information and uploaded bank proof are private
                  account records. They are not displayed on your public
                  property listings.
                </div>

                <div className="nosProfileGrid2">
                  <label className="nosProfileField nosProfileFull">
                    <span>
                      Account Holder Name <b>*</b>
                    </span>
                    <input
                      type="text"
                      name="bank_account_name"
                      value={form.bank_account_name}
                      onChange={updateField}
                      placeholder="Name exactly as per bank account"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>
                      Bank Name <b>*</b>
                    </span>
                    <input
                      type="text"
                      name="bank_name"
                      value={form.bank_name}
                      onChange={updateField}
                      placeholder="Bank name"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>Branch Name</span>
                    <input
                      type="text"
                      name="bank_branch"
                      value={form.bank_branch}
                      onChange={updateField}
                      placeholder="Bank branch"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>
                      Account Type <b>*</b>
                    </span>
                    <select
                      name="bank_account_type"
                      value={form.bank_account_type}
                      onChange={updateField}
                    >
                      <option value="">Select account type</option>
                      <option value="savings">Savings Account</option>
                      <option value="current">Current Account</option>
                    </select>
                  </label>

                  <label className="nosProfileField">
                    <span>
                      IFSC Code <b>*</b>
                    </span>
                    <input
                      type="text"
                      name="bank_ifsc"
                      value={form.bank_ifsc}
                      onChange={updateField}
                      placeholder="Example: HDFC0001234"
                      maxLength={11}
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>
                      Account Number <b>*</b>
                    </span>
                    <input
                      type="password"
                      name="bank_account_number"
                      value={form.bank_account_number}
                      onChange={updateField}
                      placeholder="Enter account number"
                      autoComplete="off"
                    />
                  </label>

                  <label className="nosProfileField">
                    <span>
                      Confirm Account Number <b>*</b>
                    </span>
                    <input
                      type="text"
                      name="confirm_bank_account_number"
                      value={form.confirm_bank_account_number}
                      onChange={updateField}
                      placeholder="Re-enter account number"
                      autoComplete="off"
                    />
                  </label>
                </div>

                {form.bank_account_number ? (
                  <div className="nosProfileAccountHint">
                    Saved account ending:{' '}
                    <strong>
                      {maskAccountNumber(form.bank_account_number)}
                    </strong>
                  </div>
                ) : null}

                <div className="nosProfileChequeSection">
                  <div className="nosProfileChequeTitle">
                    <div>
                      <h3>
                        Cancelled Cheque / Bank Proof <b>*</b>
                      </h3>
                      <p>
                        Upload a clear cancelled cheque, bank statement
                        header or passbook page showing the account
                        details.
                      </p>
                    </div>

                    {existingChequePath ? (
                      <span className="nosProfileUploadedBadge">
                        Document on file
                      </span>
                    ) : null}
                  </div>

                  <label className="nosProfileUploadBox">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleChequeSelection}
                    />

                    <div className="nosProfileUploadIcon">↑</div>

                    <div>
                      <strong>
                        {chequeFile
                          ? chequeFile.name
                          : 'Choose cancelled cheque or bank proof'}
                      </strong>

                      <span>
                        JPG, PNG, WebP or PDF. Maximum size 5 MB.
                      </span>
                    </div>
                  </label>

                  {chequePreviewUrl ? (
                    <div className="nosProfilePreview">
                      <img
                        src={chequePreviewUrl}
                        alt="Selected bank document preview"
                      />
                      <div>
                        <strong>New document selected</strong>
                        <span>
                          It will replace the current document after you
                          save.
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {!chequeFile && existingChequePath ? (
                    <div className="nosProfileExistingDocument">
                      <div>
                        <strong>Bank document already uploaded</strong>
                        <span>
                          Upload another file above only if you want to
                          replace it.
                        </span>
                      </div>

                      {existingChequeUrl ? (
                        <a
                          href={existingChequeUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Document
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
                    'Host Profile'}
                </h3>

                <p>{form.email || user?.email || ''}</p>

                <div className="nosProfileSideDivider" />

                <div className="nosProfileSideRow">
                  <span>Host Status</span>
                  <strong className="nosProfileGreen">
                    {host?.status === 'active'
                      ? 'Active'
                      : host?.status || '-'}
                  </strong>
                </div>

                <div className="nosProfileSideRow">
                  <span>Bank Details</span>
                  <strong
                    className={
                      bankDetailsComplete
                        ? 'nosProfileGreen'
                        : 'nosProfileOrange'
                    }
                  >
                    {bankDetailsComplete ? 'Complete' : 'Incomplete'}
                  </strong>
                </div>
              </section>

              <section className="nosProfileSideCard">
                <h3>Bank Details Required</h3>

                <div className="nosProfileChecklist">
                  <div
                    className={
                      form.bank_account_name ? 'done' : ''
                    }
                  >
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
                    IFSC code
                  </div>

                  <div
                    className={
                      form.bank_account_type ? 'done' : ''
                    }
                  >
                    <span>✓</span>
                    Account type
                  </div>

                  <div className={existingChequePath ? 'done' : ''}>
                    <span>✓</span>
                    Cancelled cheque / bank proof
                  </div>
                </div>
              </section>

              <section className="nosProfileSideCard nosProfileInfoCard">
                <h3>About Settlements</h3>
                <p>
                  Automatic host payouts are not enabled in the current
                  phase. NightOutStays will keep these bank details for
                  manual settlement records.
                </p>
              </section>
            </aside>
          </div>

          <div className="nosProfileBottomBar">
            <div>
              {bankDetailsComplete
                ? 'Your required bank details are complete.'
                : 'Complete all required bank details before saving.'}
            </div>

            <button
              type="submit"
              className="nosProfileSaveButton"
              disabled={saving || uploadingCheque}
            >
              {saving || uploadingCheque
                ? 'Saving...'
                : 'Save Profile & Bank Details'}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .nosProfilePage {
          min-height: 100vh;
          background: #f5f7fa;
          color: #172033;
          padding: 34px 0 120px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .nosProfileShell {
          width: min(1450px, calc(100% - 48px));
          margin: 0 auto;
        }

        .nosProfileTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 30px;
          margin-bottom: 28px;
        }

        .nosProfileTop h1 {
          margin: 5px 0 8px;
          font-size: 34px;
          line-height: 1.1;
          color: #15233b;
        }

        .nosProfileTop p {
          margin: 0;
          color: #667085;
          font-size: 15px;
        }

        .nosProfileEyebrow,
        .nosProfileSectionLabel {
          color: #a67c25;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .nosProfileBack {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 18px;
          border: 1px solid #d8dee8;
          border-radius: 10px;
          background: #fff;
          color: #172033;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }

        .nosProfileBack:hover {
          background: #f9fafb;
        }

        .nosProfileAlert {
          margin-bottom: 20px;
          padding: 14px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
        }

        .nosProfileError {
          background: #fff1f1;
          border: 1px solid #f4b8b8;
          color: #a82828;
        }

        .nosProfileSuccess {
          background: #edf9f0;
          border: 1px solid #a9dfb4;
          color: #1f7032;
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
          min-width: 0;
        }

        .nosProfileSide {
          display: flex;
          flex-direction: column;
          gap: 18px;
          position: sticky;
          top: 24px;
        }

        .nosProfileCard,
        .nosProfileSideCard {
          background: #fff;
          border: 1px solid #e1e6ee;
          border-radius: 16px;
          box-shadow: 0 3px 12px rgba(22, 34, 51, 0.04);
        }

        .nosProfileCard {
          padding: 25px;
        }

        .nosProfileSideCard {
          padding: 22px;
        }

        .nosProfileCardHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .nosProfileCardHeader h2 {
          margin: 4px 0 6px;
          color: #17233a;
          font-size: 21px;
        }

        .nosProfileCardHeader p {
          margin: 0;
          max-width: 680px;
          color: #697386;
          font-size: 13px;
          line-height: 1.5;
        }

        .nosProfileStatus,
        .nosProfileBankBadge,
        .nosProfileUploadedBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .nosProfileStatus {
          background: #f1f3f6;
          color: #5b6472;
        }

        .nosProfileStatusActive,
        .nosProfileComplete {
          background: #eaf8ee;
          color: #24713a;
        }

        .nosProfileIncomplete {
          background: #fff4df;
          color: #9b6513;
        }

        .nosProfileUploadedBadge {
          background: #eaf8ee;
          color: #24713a;
        }

        .nosProfileGrid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .nosProfileFull {
          grid-column: 1 / -1;
        }

        .nosProfileField {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .nosProfileField span {
          color: #344054;
          font-size: 12px;
          font-weight: 800;
        }

        .nosProfileField span b,
        .nosProfileChequeTitle h3 b {
          color: #c13a3a;
        }

        .nosProfileField input,
        .nosProfileField select,
        .nosProfileField textarea {
          width: 100%;
          border: 1px solid #d7dde6;
          border-radius: 9px;
          outline: none;
          background: #fff;
          color: #172033;
          font: inherit;
          font-size: 14px;
          transition: border 0.15s ease, box-shadow 0.15s ease;
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
          border-color: #9a7a35;
          box-shadow: 0 0 0 3px rgba(154, 122, 53, 0.1);
        }

        .nosProfileBankCard {
          border-top: 4px solid #b18a3d;
        }

        .nosProfileSecurityNote {
          margin: -5px 0 22px;
          padding: 12px 14px;
          border-radius: 9px;
          background: #f7f4ed;
          color: #65583e;
          font-size: 12px;
          line-height: 1.5;
        }

        .nosProfileAccountHint {
          margin-top: 16px;
          color: #697386;
          font-size: 12px;
        }

        .nosProfileChequeSection {
          margin-top: 25px;
          padding-top: 24px;
          border-top: 1px solid #e7eaf0;
        }

        .nosProfileChequeTitle {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 15px;
        }

        .nosProfileChequeTitle h3 {
          margin: 0 0 6px;
          color: #17233a;
          font-size: 15px;
        }

        .nosProfileChequeTitle p {
          margin: 0;
          max-width: 700px;
          color: #697386;
          font-size: 12px;
          line-height: 1.5;
        }

        .nosProfileUploadBox {
          min-height: 105px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1.5px dashed #c9d0db;
          border-radius: 12px;
          background: #fafbfc;
          cursor: pointer;
        }

        .nosProfileUploadBox:hover {
          border-color: #a98a49;
          background: #fcfbf7;
        }

        .nosProfileUploadBox input {
          display: none;
        }

        .nosProfileUploadIcon {
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #17233a;
          color: #fff;
          font-size: 21px;
          font-weight: 700;
        }

        .nosProfileUploadBox strong,
        .nosProfileUploadBox span {
          display: block;
        }

        .nosProfileUploadBox strong {
          margin-bottom: 5px;
          color: #253047;
          font-size: 13px;
        }

        .nosProfileUploadBox span {
          color: #7a8392;
          font-size: 11px;
        }

        .nosProfilePreview,
        .nosProfileExistingDocument {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px;
          border: 1px solid #e1e6ed;
          border-radius: 10px;
          background: #fff;
        }

        .nosProfilePreview img {
          width: 90px;
          height: 65px;
          border-radius: 7px;
          object-fit: cover;
          border: 1px solid #e1e5eb;
        }

        .nosProfilePreview strong,
        .nosProfilePreview span,
        .nosProfileExistingDocument strong,
        .nosProfileExistingDocument span {
          display: block;
        }

        .nosProfilePreview strong,
        .nosProfileExistingDocument strong {
          margin-bottom: 4px;
          color: #263148;
          font-size: 12px;
        }

        .nosProfilePreview span,
        .nosProfileExistingDocument span {
          color: #737c8b;
          font-size: 11px;
        }

        .nosProfileExistingDocument {
          justify-content: space-between;
        }

        .nosProfileExistingDocument a {
          flex-shrink: 0;
          color: #8c6c2f;
          text-decoration: none;
          font-size: 12px;
          font-weight: 800;
        }

        .nosProfileSideCard h3 {
          margin: 0 0 12px;
          color: #17233a;
          font-size: 15px;
        }

        .nosProfileAvatar {
          width: 58px;
          height: 58px;
          margin-bottom: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #17233a;
          color: #d9b86b;
          font-size: 24px;
          font-weight: 800;
        }

        .nosProfileSideCard > p {
          margin: -5px 0 0;
          color: #7a8391;
          font-size: 12px;
          word-break: break-word;
        }

        .nosProfileSideDivider {
          height: 1px;
          margin: 18px 0;
          background: #e8ebf0;
        }

        .nosProfileSideRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 7px 0;
          font-size: 12px;
        }

        .nosProfileSideRow span {
          color: #747d8c;
        }

        .nosProfileSideRow strong {
          text-transform: capitalize;
        }

        .nosProfileGreen {
          color: #26723a;
        }

        .nosProfileOrange {
          color: #a66a11;
        }

        .nosProfileChecklist {
          display: flex;
          flex-direction: column;
          gap: 11px;
        }

        .nosProfileChecklist div {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #7a8390;
          font-size: 12px;
        }

        .nosProfileChecklist div span {
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          background: #eef0f3;
          color: #a5acb6;
          font-size: 10px;
          font-weight: 900;
        }

        .nosProfileChecklist div.done {
          color: #2f5939;
        }

        .nosProfileChecklist div.done span {
          background: #e7f6eb;
          color: #2d793f;
        }

        .nosProfileInfoCard {
          background: #17233a;
          border-color: #17233a;
        }

        .nosProfileInfoCard h3 {
          color: #fff;
        }

        .nosProfileInfoCard > p {
          margin: 0;
          color: #cbd3df;
          font-size: 12px;
          line-height: 1.65;
        }

        .nosProfileBottomBar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 50;
          min-height: 76px;
          padding: 14px max(24px, calc((100vw - 1450px) / 2));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          background: rgba(255, 255, 255, 0.97);
          border-top: 1px solid #dfe4eb;
          box-shadow: 0 -4px 18px rgba(24, 35, 53, 0.06);
          backdrop-filter: blur(8px);
        }

        .nosProfileBottomBar > div {
          color: #687385;
          font-size: 12px;
        }

        .nosProfileSaveButton {
          min-width: 225px;
          min-height: 47px;
          padding: 0 22px;
          border: 0;
          border-radius: 10px;
          background: #17233a;
          color: #fff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
        }

        .nosProfileSaveButton:hover:not(:disabled) {
          background: #243653;
        }

        .nosProfileSaveButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .nosProfileLoading {
          min-height: 70vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: #f7f8fb;
          color: #15233b;
          font-family: Arial, Helvetica, sans-serif;
        }

        .nosProfileLoader {
          width: 38px;
          height: 38px;
          border: 4px solid #dfe4ec;
          border-top-color: #15233b;
          border-radius: 50%;
          animation: nosProfileSpin 0.8s linear infinite;
        }

        @keyframes nosProfileSpin {
          to {
            transform: rotate(360deg);
          }
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

          .nosProfileInfoCard {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 700px) {
          .nosProfilePage {
            padding-top: 22px;
          }

          .nosProfileShell {
            width: min(100% - 28px, 1450px);
          }

          .nosProfileTop {
            flex-direction: column;
          }

          .nosProfileTop h1 {
            font-size: 28px;
          }

          .nosProfileGrid2,
          .nosProfileSide {
            grid-template-columns: 1fr;
          }

          .nosProfileCard {
            padding: 19px;
          }

          .nosProfileCardHeader,
          .nosProfileChequeTitle {
            flex-direction: column;
          }

          .nosProfileBottomBar {
            padding: 12px 14px;
            flex-direction: column;
            align-items: stretch;
          }

          .nosProfileBottomBar > div {
            display: none;
          }

          .nosProfileSaveButton {
            width: 100%;
          }

          .nosProfileExistingDocument {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}