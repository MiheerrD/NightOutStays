'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'admins', label: 'Admins' },
  { key: 'hosts', label: 'Hosts' },
  { key: 'properties', label: 'Properties' },
  { key: 'guests', label: 'Guests' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'payment_holds', label: 'Payment Holds' },
  { key: 'messages', label: 'Messages' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
];

const ACTIONS = [
  { key: 'can_view', label: 'View' },
  { key: 'can_add', label: 'Add' },
  { key: 'can_edit', label: 'Edit' },
  { key: 'can_approve', label: 'Approve' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_block', label: 'Block' },
  { key: 'can_export', label: 'Export' },
];

function emptyPermission(moduleKey) {
  return {
    module: moduleKey,
    can_view: false,
    can_add: false,
    can_edit: false,
    can_approve: false,
    can_delete: false,
    can_block: false,
    can_export: false,
  };
}

function buildEmptyPermissions() {
  const result = {};

  MODULES.forEach((module) => {
    result[module.key] =
      emptyPermission(module.key);
  });

  return result;
}

function formatDate(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  } catch {
    return '—';
  }
}

export default function AdminManagementPage() {
  const [session, setSession] =
    useState(null);

  const [currentAdmin, setCurrentAdmin] =
    useState(null);

  const [admins, setAdmins] =
    useState([]);

  const [selectedAdmin, setSelectedAdmin] =
    useState(null);

  const [permissions, setPermissions] =
    useState(buildEmptyPermissions());

  const [showAddAdmin, setShowAddAdmin] =
    useState(false);

  const [newAdminName, setNewAdminName] =
    useState('');

  const [newAdminEmail, setNewAdminEmail] =
    useState('');

  const [
    newAdminFullAccess,
    setNewAdminFullAccess,
  ] = useState(false);

  const [checking, setChecking] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  useEffect(() => {
    initialise();
  }, []);

  async function initialise() {
    setChecking(true);
    setError('');

    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!currentSession) {
        window.location.replace(
          '/admin/login'
        );

        return;
      }

      setSession(currentSession);

      const {
        data: profile,
        error: profileError,
      } =
        await supabase
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
            currentSession.user.id
          )
          .maybeSingle();

      if (
        profileError ||
        !profile ||
        !profile.is_active ||
        profile.role !== 'super_admin'
      ) {
        throw new Error(
          'Only Super Admin can manage Admin users.'
        );
      }

      setCurrentAdmin(profile);

      await loadAdmins();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to open Admin Management.'
      );
    } finally {
      setChecking(false);
    }
  }

  async function loadAdmins() {
    setLoading(true);

    try {
      const {
        data,
        error: loadError,
      } =
        await supabase
          .from('admin_profiles')
          .select(
            `
              user_id,
              full_name,
              email,
              role,
              is_active,
              full_access,
              created_by,
              created_at,
              updated_at
            `
          )
          .order('created_at', {
            ascending: true,
          });

      if (loadError) {
        throw loadError;
      }

      setAdmins(data || []);

      if (selectedAdmin?.user_id) {
        const refreshed =
          (data || []).find(
            (item) =>
              item.user_id ===
              selectedAdmin.user_id
          );

        if (refreshed) {
          setSelectedAdmin(refreshed);
        }
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to load Admin users.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAdmin(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    const email =
      newAdminEmail
        .trim()
        .toLowerCase();

    const name =
      newAdminName.trim();

    if (!name) {
      setError(
        'Please enter the Admin full name.'
      );

      return;
    }

    if (!email) {
      setError(
        'Please enter the Admin email address.'
      );

      return;
    }

    setSaving(true);

    try {
      const {
        data,
        error: rpcError,
      } =
        await supabase.rpc(
          'super_admin_add_admin_by_email',
          {
            target_email: email,
            target_full_name: name,
            target_full_access:
              newAdminFullAccess,
          }
        );

      if (rpcError) {
        if (
          rpcError.message?.includes(
            'USER_NOT_FOUND'
          )
        ) {
          throw new Error(
            'No NightOutStays account exists with this email. Ask the person to create an account first, then add them as Admin.'
          );
        }

        throw rpcError;
      }

      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminFullAccess(false);
      setShowAddAdmin(false);

      setSuccess(
        'Admin added successfully.'
      );

      await loadAdmins();

      const createdAdmin =
        Array.isArray(data)
          ? data[0]
          : null;

      if (createdAdmin?.user_id) {
        const normalized = {
          ...createdAdmin,
          created_at: null,
          updated_at: null,
        };

        await openAdmin(normalized);
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to add Admin.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function openAdmin(admin) {
    setSelectedAdmin(admin);
    setError('');
    setSuccess('');

    const blank =
      buildEmptyPermissions();

    if (
      admin.role === 'super_admin'
    ) {
      setPermissions(blank);
      return;
    }

    try {
      const {
        data,
        error: permissionError,
      } =
        await supabase
          .from('admin_permissions')
          .select(
            `
              module,
              can_view,
              can_add,
              can_edit,
              can_approve,
              can_delete,
              can_block,
              can_export
            `
          )
          .eq(
            'admin_user_id',
            admin.user_id
          );

      if (permissionError) {
        throw permissionError;
      }

      (data || []).forEach((row) => {
        if (blank[row.module]) {
          blank[row.module] = {
            ...blank[row.module],
            ...row,
          };
        }
      });

      setPermissions(blank);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to load Admin permissions.'
      );
    }
  }

  function closeAdmin() {
    setSelectedAdmin(null);
    setPermissions(
      buildEmptyPermissions()
    );
    setError('');
    setSuccess('');
  }

  function updatePermission(
    moduleKey,
    actionKey,
    checked
  ) {
    setPermissions((previous) => ({
      ...previous,

      [moduleKey]: {
        ...previous[moduleKey],
        [actionKey]: checked,
      },
    }));
  }

  function toggleModuleAll(
    moduleKey,
    checked
  ) {
    const updated =
      emptyPermission(moduleKey);

    ACTIONS.forEach((action) => {
      updated[action.key] =
        checked;
    });

    setPermissions((previous) => ({
      ...previous,
      [moduleKey]: updated,
    }));
  }

  function toggleAllPermissions(
    checked
  ) {
    const updated = {};

    MODULES.forEach((module) => {
      updated[module.key] =
        emptyPermission(module.key);

      ACTIONS.forEach((action) => {
        updated[module.key][
          action.key
        ] = checked;
      });
    });

    setPermissions(updated);
  }

  async function savePermissions() {
    if (
      !selectedAdmin ||
      selectedAdmin.role ===
        'super_admin'
    ) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const rows =
        MODULES.map((module) => ({
          admin_user_id:
            selectedAdmin.user_id,

          module:
            module.key,

          ...permissions[
            module.key
          ],

          updated_at:
            new Date().toISOString(),
        }));

      const {
        error: upsertError,
      } =
        await supabase
          .from('admin_permissions')
          .upsert(
            rows,
            {
              onConflict:
                'admin_user_id,module',
            }
          );

      if (upsertError) {
        throw upsertError;
      }

      setSuccess(
        'Admin permissions saved successfully.'
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to save permissions.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateFullAccess(
    enabled
  ) {
    if (
      !selectedAdmin ||
      selectedAdmin.role ===
        'super_admin'
    ) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const {
        data,
        error: updateError,
      } =
        await supabase
          .from('admin_profiles')
          .update({
            full_access: enabled,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'user_id',
            selectedAdmin.user_id
          )
          .select(
            `
              user_id,
              full_name,
              email,
              role,
              is_active,
              full_access,
              created_by,
              created_at,
              updated_at
            `
          )
          .single();

      if (updateError) {
        throw updateError;
      }

      setSelectedAdmin(data);

      setAdmins((previous) =>
        previous.map((item) =>
          item.user_id ===
          data.user_id
            ? data
            : item
        )
      );

      setSuccess(
        enabled
          ? 'Full Access enabled.'
          : 'Full Access disabled. Individual permissions will now apply.'
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to update Full Access.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeAdminStatus(
    admin,
    makeActive
  ) {
    if (
      !admin ||
      admin.role === 'super_admin'
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        makeActive
          ? `Activate ${admin.full_name || 'this Admin'}?`
          : `Suspend ${admin.full_name || 'this Admin'}? They will lose Admin access immediately.`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const {
        error: rpcError,
      } =
        await supabase.rpc(
          'super_admin_set_admin_status',
          {
            target_user_id:
              admin.user_id,

            target_is_active:
              makeActive,
          }
        );

      if (rpcError) {
        throw rpcError;
      }

      setSuccess(
        makeActive
          ? 'Admin activated successfully.'
          : 'Admin suspended successfully.'
      );

      await loadAdmins();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to change Admin status.'
      );
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    return {
      total: admins.length,

      superAdmins:
        admins.filter(
          (admin) =>
            admin.role ===
            'super_admin'
        ).length,

      activeAdmins:
        admins.filter(
          (admin) =>
            admin.role === 'admin' &&
            admin.is_active
        ).length,

      suspended:
        admins.filter(
          (admin) =>
            admin.role === 'admin' &&
            !admin.is_active
        ).length,
    };
  }, [admins]);

  if (checking) {
    return (
      <>
        <main className="adminUsersPage">
          <div className="adminLoading">
            Loading Admin Management...
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (!currentAdmin) {
    return (
      <>
        <main className="adminUsersPage">
          <div className="adminLoading">
            <h2>
              Access Denied
            </h2>

            <p>
              {error ||
                'Super Admin access is required.'}
            </p>
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (selectedAdmin) {
    const isSuperAdmin =
      selectedAdmin.role ===
      'super_admin';

    return (
      <>
        <main className="adminUsersPage">
          <div className="adminUsersContainer">
            <button
              type="button"
              className="adminBackButton"
              onClick={closeAdmin}
            >
              ← Back to Admins
            </button>

            <div className="adminPageHeader">
              <div>
                <span className="adminEyebrow">
                  ADMIN ACCESS CONTROL
                </span>

                <h1>
                  {selectedAdmin.full_name ||
                    'Admin'}
                </h1>

                <p>
                  {selectedAdmin.email ||
                    'No email available'}
                </p>
              </div>

              <div className="adminHeaderBadges">
                <span
                  className={
                    isSuperAdmin
                      ? 'roleBadge super'
                      : 'roleBadge'
                  }
                >
                  {isSuperAdmin
                    ? 'SUPER ADMIN'
                    : 'ADMIN'}
                </span>

                <span
                  className={
                    selectedAdmin.is_active
                      ? 'statusBadge active'
                      : 'statusBadge suspended'
                  }
                >
                  {selectedAdmin.is_active
                    ? 'ACTIVE'
                    : 'SUSPENDED'}
                </span>
              </div>
            </div>

            {error && (
              <div className="adminError">
                {error}
              </div>
            )}

            {success && (
              <div className="adminSuccess">
                {success}
              </div>
            )}

            <div className="adminSummaryGrid">
              <Summary
                label="Role"
                value={
                  isSuperAdmin
                    ? 'Super Admin'
                    : 'Admin'
                }
              />

              <Summary
                label="Access"
                value={
                  isSuperAdmin ||
                  selectedAdmin.full_access
                    ? 'Full Access'
                    : 'Limited Access'
                }
              />

              <Summary
                label="Status"
                value={
                  selectedAdmin.is_active
                    ? 'Active'
                    : 'Suspended'
                }
              />

              <Summary
                label="Created"
                value={formatDate(
                  selectedAdmin.created_at
                )}
              />
            </div>

            {isSuperAdmin ? (
              <section className="superAdminProtected">
                <div className="protectedIcon">
                  ★
                </div>

                <div>
                  <h2>
                    Primary Super Admin
                  </h2>

                  <p>
                    The Super Admin always has
                    complete platform access.
                    Permissions and account status
                    cannot be restricted from this
                    page.
                  </p>
                </div>
              </section>
            ) : (
              <>
                <section className="accessControlCard">
                  <div>
                    <span className="adminEyebrow">
                      ACCESS LEVEL
                    </span>

                    <h2>
                      Full Access
                    </h2>

                    <p>
                      Give this Admin access to
                      every Admin module and
                      action.
                    </p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={
                        selectedAdmin.full_access
                      }
                      disabled={saving}
                      onChange={(event) =>
                        updateFullAccess(
                          event.target.checked
                        )
                      }
                    />

                    <span className="slider" />
                  </label>
                </section>

                {!selectedAdmin.full_access && (
                  <section className="permissionsCard">
                    <div className="permissionsHeading">
                      <div>
                        <span className="adminEyebrow">
                          LIMITED ACCESS
                        </span>

                        <h2>
                          Module Permissions
                        </h2>

                        <p>
                          Select exactly what this
                          Admin is allowed to do.
                        </p>
                      </div>

                      <div className="bulkPermissionButtons">
                        <button
                          type="button"
                          onClick={() =>
                            toggleAllPermissions(
                              true
                            )
                          }
                        >
                          Select All
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleAllPermissions(
                              false
                            )
                          }
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="permissionTableWrap">
                      <table className="permissionTable">
                        <thead>
                          <tr>
                            <th>
                              Module
                            </th>

                            <th>
                              All
                            </th>

                            {ACTIONS.map(
                              (action) => (
                                <th
                                  key={
                                    action.key
                                  }
                                >
                                  {
                                    action.label
                                  }
                                </th>
                              )
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {MODULES.map(
                            (module) => {
                              const row =
                                permissions[
                                  module.key
                                ];

                              const allChecked =
                                ACTIONS.every(
                                  (action) =>
                                    row?.[
                                      action.key
                                    ] === true
                                );

                              return (
                                <tr
                                  key={
                                    module.key
                                  }
                                >
                                  <td>
                                    <strong>
                                      {
                                        module.label
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={
                                        allChecked
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        toggleModuleAll(
                                          module.key,
                                          event
                                            .target
                                            .checked
                                        )
                                      }
                                    />
                                  </td>

                                  {ACTIONS.map(
                                    (
                                      action
                                    ) => (
                                      <td
                                        key={
                                          action.key
                                        }
                                      >
                                        <input
                                          type="checkbox"
                                          checked={
                                            row?.[
                                              action
                                                .key
                                            ] ||
                                            false
                                          }
                                          onChange={(
                                            event
                                          ) =>
                                            updatePermission(
                                              module.key,
                                              action.key,
                                              event
                                                .target
                                                .checked
                                            )
                                          }
                                        />
                                      </td>
                                    )
                                  )}
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="savePermissionsRow">
                      <button
                        type="button"
                        className="savePermissionsButton"
                        disabled={saving}
                        onClick={
                          savePermissions
                        }
                      >
                        {saving
                          ? 'Saving...'
                          : 'Save Permissions'}
                      </button>
                    </div>
                  </section>
                )}

                <section className="adminStatusCard">
                  <div>
                    <span className="adminEyebrow">
                      ADMIN STATUS
                    </span>

                    <h2>
                      {selectedAdmin.is_active
                        ? 'Admin is Active'
                        : 'Admin is Suspended'}
                    </h2>

                    <p>
                      {selectedAdmin.is_active
                        ? 'Suspending this Admin removes their Admin portal access until reactivated.'
                        : 'Activate this Admin to restore their permitted Admin access.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={
                      selectedAdmin.is_active
                        ? 'suspendButton'
                        : 'activateButton'
                    }
                    disabled={saving}
                    onClick={() =>
                      changeAdminStatus(
                        selectedAdmin,
                        !selectedAdmin.is_active
                      )
                    }
                  >
                    {selectedAdmin.is_active
                      ? 'Suspend Admin'
                      : 'Activate Admin'}
                  </button>
                </section>
              </>
            )}
          </div>
        </main>

        <Styles />
      </>
    );
  }

  return (
    <>
      <main className="adminUsersPage">
        <div className="adminUsersContainer">
          <div className="adminPageHeader">
            <div>
              <span className="adminEyebrow">
                SUPER ADMIN
              </span>

              <h1>
                Admin Management
              </h1>

              <p>
                Add Admins and control exactly
                what they can access across
                NightOutStays.
              </p>
            </div>

            <button
              type="button"
              className="addAdminButton"
              onClick={() => {
                setShowAddAdmin(
                  (previous) =>
                    !previous
                );

                setError('');
                setSuccess('');
              }}
            >
              + Add Admin
            </button>
          </div>

          {error && (
            <div className="adminError">
              {error}
            </div>
          )}

          {success && (
            <div className="adminSuccess">
              {success}
            </div>
          )}

          <div className="adminStatsGrid">
            <StatCard
              label="Total Admin Users"
              value={counts.total}
            />

            <StatCard
              label="Super Admin"
              value={counts.superAdmins}
            />

            <StatCard
              label="Active Admins"
              value={counts.activeAdmins}
            />

            <StatCard
              label="Suspended"
              value={counts.suspended}
            />
          </div>

          {showAddAdmin && (
            <section className="addAdminCard">
              <div className="addAdminHeading">
                <div>
                  <span className="adminEyebrow">
                    NEW ADMIN
                  </span>

                  <h2>
                    Add Existing User as Admin
                  </h2>

                  <p>
                    The person must already have
                    a NightOutStays account using
                    this email address.
                  </p>
                </div>

                <button
                  type="button"
                  className="closeAddButton"
                  onClick={() =>
                    setShowAddAdmin(false)
                  }
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={handleAddAdmin}
              >
                <div className="addAdminGrid">
                  <label>
                    <span>
                      FULL NAME
                    </span>

                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(event) =>
                        setNewAdminName(
                          event.target.value
                        )
                      }
                      placeholder="Admin full name"
                      required
                    />
                  </label>

                  <label>
                    <span>
                      REGISTERED EMAIL
                    </span>

                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(event) =>
                        setNewAdminEmail(
                          event.target.value
                        )
                      }
                      placeholder="admin@example.com"
                      required
                    />
                  </label>
                </div>

                <label className="fullAccessOption">
                  <input
                    type="checkbox"
                    checked={
                      newAdminFullAccess
                    }
                    onChange={(event) =>
                      setNewAdminFullAccess(
                        event.target.checked
                      )
                    }
                  />

                  <div>
                    <strong>
                      Give Full Access
                    </strong>

                    <span>
                      Admin will have access to
                      all modules and actions.
                    </span>
                  </div>
                </label>

                <div className="addAdminActions">
                  <button
                    type="submit"
                    className="createAdminButton"
                    disabled={saving}
                  >
                    {saving
                      ? 'Adding Admin...'
                      : 'Add Admin'}
                  </button>

                  <button
                    type="button"
                    className="cancelButton"
                    onClick={() =>
                      setShowAddAdmin(false)
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          <div className="adminListHeading">
            <div>
              <h2>
                Admin Users
              </h2>

              <p>
                {admins.length}{' '}
                {admins.length === 1
                  ? 'account'
                  : 'accounts'}
              </p>
            </div>

            <button
              type="button"
              className="refreshAdminsButton"
              onClick={loadAdmins}
              disabled={loading}
            >
              {loading
                ? 'Refreshing...'
                : '↻ Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="adminEmpty">
              Loading Admins...
            </div>
          ) : admins.length === 0 ? (
            <div className="adminEmpty">
              No Admin accounts found.
            </div>
          ) : (
            <div className="adminCardsGrid">
              {admins.map((admin) => (
                <AdminCard
                  key={admin.user_id}
                  admin={admin}
                  onManage={() =>
                    openAdmin(admin)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Styles />
    </>
  );
}

function AdminCard({
  admin,
  onManage,
}) {
  const superAdmin =
    admin.role === 'super_admin';

  return (
    <article className="adminUserCard">
      <div className="adminCardHeader">
        <div className="adminAvatar">
          {(admin.full_name ||
            admin.email ||
            'A')
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="adminCardIdentity">
          <h3>
            {admin.full_name ||
              'Admin'}
          </h3>

          <p>
            {admin.email ||
              'No email'}
          </p>
        </div>

        <span
          className={
            admin.is_active
              ? 'statusDot active'
              : 'statusDot'
          }
        />
      </div>

      <div className="adminCardBadges">
        <span
          className={
            superAdmin
              ? 'roleBadge super'
              : 'roleBadge'
          }
        >
          {superAdmin
            ? 'SUPER ADMIN'
            : 'ADMIN'}
        </span>

        <span
          className={
            admin.is_active
              ? 'statusBadge active'
              : 'statusBadge suspended'
          }
        >
          {admin.is_active
            ? 'ACTIVE'
            : 'SUSPENDED'}
        </span>
      </div>

      <div className="adminAccessBox">
        <span>
          ACCESS LEVEL
        </span>

        <strong>
          {superAdmin ||
          admin.full_access
            ? 'Full Access'
            : 'Limited Access'}
        </strong>
      </div>

      <div className="adminCardFooter">
        <span>
          Created{' '}
          {formatDate(
            admin.created_at
          )}
        </span>

        <button
          type="button"
          onClick={onManage}
        >
          {superAdmin
            ? 'View'
            : 'Manage Access'}
        </button>
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
}) {
  return (
    <div className="adminStatCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Summary({
  label,
  value,
}) {
  return (
    <div className="adminSummaryCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
      }

      .adminUsersPage {
        min-height: 100vh;
        background: #f7f9fc;
        color: #101828;
      }

      .adminUsersContainer {
        width: calc(100% - 64px);
        max-width: 1500px;
        margin: 0 auto;
        padding: 34px 0 65px;
      }

      .adminPageHeader {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 25px;
        margin-bottom: 25px;
      }

      .adminEyebrow {
        display: block;
        margin-bottom: 7px;
        color: #667085;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1.1px;
      }

      .adminPageHeader h1 {
        margin: 0;
        color: #101828;
        font-size: 34px;
        letter-spacing: -0.8px;
      }

      .adminPageHeader p {
        margin: 8px 0 0;
        color: #667085;
        font-size: 14px;
        line-height: 1.6;
      }

      .addAdminButton,
      .createAdminButton,
      .savePermissionsButton,
      .activateButton {
        border: 0;
        border-radius: 9px;
        background: #074b91;
        color: #ffffff;
        min-height: 43px;
        padding: 0 18px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .adminStatsGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 13px;
        margin-bottom: 22px;
      }

      .adminStatCard {
        min-height: 93px;
        border: 1px solid #dce3ec;
        border-radius: 13px;
        background: #ffffff;
        padding: 18px;
      }

      .adminStatCard span,
      .adminSummaryCard span,
      .adminAccessBox span {
        color: #68778c;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.6px;
      }

      .adminStatCard strong {
        display: block;
        margin-top: 11px;
        font-size: 27px;
      }

      .addAdminCard,
      .permissionsCard,
      .accessControlCard,
      .adminStatusCard,
      .superAdminProtected {
        border: 1px solid #dce3ec;
        border-radius: 15px;
        background: #ffffff;
        padding: 20px;
        margin-bottom: 20px;
      }

      .addAdminHeading,
      .permissionsHeading,
      .accessControlCard,
      .adminStatusCard {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }

      .addAdminHeading h2,
      .permissionsHeading h2,
      .accessControlCard h2,
      .adminStatusCard h2 {
        margin: 0;
        font-size: 19px;
      }

      .addAdminHeading p,
      .permissionsHeading p,
      .accessControlCard p,
      .adminStatusCard p {
        margin: 5px 0 0;
        color: #667085;
        font-size: 12px;
        line-height: 1.5;
      }

      .closeAddButton {
        border: 0;
        background: transparent;
        font-size: 26px;
        cursor: pointer;
      }

      .addAdminGrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 13px;
        margin-top: 20px;
      }

      .addAdminGrid label {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .addAdminGrid label > span {
        color: #667085;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.7px;
      }

      .addAdminGrid input {
        width: 100%;
        min-height: 45px;
        border: 1px solid #ccd5df;
        border-radius: 9px;
        padding: 0 12px;
        font-size: 14px;
      }

      .fullAccessOption {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 16px;
        padding: 13px;
        border: 1px solid #dce3ec;
        border-radius: 9px;
        background: #f9fbfd;
      }

      .fullAccessOption input {
        margin-top: 3px;
      }

      .fullAccessOption div {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .fullAccessOption strong {
        font-size: 13px;
      }

      .fullAccessOption span {
        color: #667085;
        font-size: 11px;
      }

      .addAdminActions {
        display: flex;
        gap: 9px;
        margin-top: 17px;
      }

      .cancelButton,
      .refreshAdminsButton,
      .bulkPermissionButtons button {
        min-height: 40px;
        padding: 0 14px;
        border: 1px solid #d1d9e3;
        border-radius: 8px;
        background: #ffffff;
        color: #31445c;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .adminListHeading {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        margin: 25px 0 12px;
      }

      .adminListHeading h2 {
        margin: 0;
        font-size: 21px;
      }

      .adminListHeading p {
        margin: 4px 0 0;
        color: #667085;
        font-size: 12px;
      }

      .adminCardsGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px;
      }

      .adminUserCard {
        border: 1px solid #dce3ec;
        border-radius: 14px;
        background: #ffffff;
        padding: 18px;
      }

      .adminCardHeader {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .adminAvatar {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #e7eef7;
        color: #0b4b8d;
        font-size: 18px;
        font-weight: 900;
      }

      .adminCardIdentity {
        min-width: 0;
        flex: 1;
      }

      .adminCardIdentity h3 {
        margin: 0;
        font-size: 16px;
      }

      .adminCardIdentity p {
        margin: 3px 0 0;
        color: #667085;
        font-size: 12px;
        overflow-wrap: anywhere;
      }

      .statusDot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #d92d20;
      }

      .statusDot.active {
        background: #12b76a;
      }

      .adminCardBadges,
      .adminHeaderBadges {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
        margin-top: 15px;
      }

      .roleBadge,
      .statusBadge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 23px;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 900;
      }

      .roleBadge {
        background: #e9f2ff;
        color: #155ca8;
      }

      .roleBadge.super {
        background: #0b1d3a;
        color: white;
      }

      .statusBadge.active {
        background: #e7f8ed;
        color: #137333;
      }

      .statusBadge.suspended {
        background: #feeceb;
        color: #b42318;
      }

      .adminAccessBox {
        margin-top: 15px;
        padding: 12px;
        border: 1px solid #e2e7ed;
        border-radius: 9px;
        background: #fafbfc;
      }

      .adminAccessBox strong {
        display: block;
        margin-top: 4px;
        font-size: 13px;
      }

      .adminCardFooter {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-top: 15px;
        padding-top: 13px;
        border-top: 1px solid #edf0f3;
      }

      .adminCardFooter span {
        color: #667085;
        font-size: 10px;
      }

      .adminCardFooter button {
        min-height: 36px;
        padding: 0 12px;
        border: 1px solid #0b315d;
        border-radius: 7px;
        background: #0b315d;
        color: white;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
      }

      .adminBackButton {
        border: 0;
        background: transparent;
        padding: 0;
        margin-bottom: 18px;
        color: #42526a;
        font-weight: 800;
        cursor: pointer;
      }

      .adminSummaryGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 11px;
        margin-bottom: 18px;
      }

      .adminSummaryCard {
        border: 1px solid #dce3ec;
        border-radius: 10px;
        background: white;
        padding: 13px;
      }

      .adminSummaryCard strong {
        display: block;
        margin-top: 5px;
        font-size: 13px;
      }

      .superAdminProtected {
        display: flex;
        align-items: flex-start;
        gap: 15px;
        border-color: #b7cbe2;
        background: #f4f8fd;
      }

      .protectedIcon {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: #0b315d;
        color: white;
        font-size: 19px;
      }

      .superAdminProtected h2 {
        margin: 0;
        font-size: 18px;
      }

      .superAdminProtected p {
        margin: 6px 0 0;
        color: #5f6f84;
        line-height: 1.55;
      }

      .switch {
        position: relative;
        width: 52px;
        height: 29px;
        flex-shrink: 0;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: #c9d1dc;
        cursor: pointer;
        transition: 0.2s;
      }

      .slider::before {
        content: '';
        position: absolute;
        width: 23px;
        height: 23px;
        left: 3px;
        top: 3px;
        border-radius: 50%;
        background: white;
        transition: 0.2s;
      }

      .switch input:checked + .slider {
        background: #0b5aa6;
      }

      .switch input:checked + .slider::before {
        transform: translateX(23px);
      }

      .bulkPermissionButtons {
        display: flex;
        gap: 7px;
      }

      .permissionTableWrap {
        margin-top: 18px;
        overflow-x: auto;
      }

      .permissionTable {
        width: 100%;
        min-width: 900px;
        border-collapse: collapse;
      }

      .permissionTable th,
      .permissionTable td {
        padding: 10px;
        border-bottom: 1px solid #e6ebf1;
        text-align: center;
        font-size: 11px;
      }

      .permissionTable th:first-child,
      .permissionTable td:first-child {
        text-align: left;
      }

      .permissionTable th {
        background: #f7f9fc;
        color: #526175;
        font-size: 10px;
        font-weight: 900;
      }

      .permissionTable input {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .savePermissionsRow {
        display: flex;
        justify-content: flex-end;
        margin-top: 17px;
      }

      .suspendButton {
        min-height: 41px;
        padding: 0 16px;
        border: 1px solid #b42318;
        border-radius: 8px;
        background: #b42318;
        color: white;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .adminError,
      .adminSuccess {
        padding: 12px 14px;
        border-radius: 9px;
        margin-bottom: 15px;
        font-size: 12px;
        font-weight: 700;
      }

      .adminError {
        border: 1px solid #f2b3ad;
        background: #fff4f3;
        color: #b42318;
      }

      .adminSuccess {
        border: 1px solid #a8dfb8;
        background: #eefaf2;
        color: #137333;
      }

      .adminEmpty,
      .adminLoading {
        border: 1px solid #dce3ec;
        border-radius: 14px;
        background: white;
        padding: 40px 20px;
        text-align: center;
      }

      .adminLoading {
        width: min(800px, calc(100% - 40px));
        margin: 50px auto;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      @media (max-width: 1000px) {
        .adminStatsGrid,
        .adminSummaryGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .adminCardsGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 700px) {
        .adminUsersContainer {
          width: calc(100% - 24px);
          padding-top: 22px;
        }

        .adminPageHeader,
        .addAdminHeading,
        .permissionsHeading,
        .accessControlCard,
        .adminStatusCard {
          flex-direction: column;
          align-items: flex-start;
        }

        .adminPageHeader h1 {
          font-size: 27px;
        }

        .addAdminGrid {
          grid-template-columns: 1fr;
        }

        .adminHeaderBadges {
          margin-top: 0;
        }

        .bulkPermissionButtons {
          width: 100%;
        }
      }

      @media (max-width: 480px) {
        .adminStatsGrid,
        .adminSummaryGrid {
          grid-template-columns: 1fr;
        }

        .adminCardFooter {
          flex-direction: column;
          align-items: stretch;
        }

        .adminCardFooter button {
          width: 100%;
        }
      }
    `}</style>
  );
}