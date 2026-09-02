'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const statusTabs = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'rejected', label: 'Rejected' },
];

export default function AdminHostsPage() {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadHosts();
  }, []);

  async function loadHosts() {
    try {
      setLoading(true);
      setError('');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        window.location.href = '/login?redirect=/admin/hosts';
        return;
      }

      const { data: roles, error: roleError } = await supabase.rpc(
        'get_my_platform_roles'
      );

      if (roleError) {
        throw roleError;
      }

      const isSuperAdmin = (roles || []).some(
        (item) => item.role === 'super_admin' && item.is_active === true
      );

      if (!isSuperAdmin) {
        setError('Access denied. Super Admin access is required.');
        setLoading(false);
        return;
      }

      const { data, error: hostsError } = await supabase
        .from('host_profiles')
        .select(
          `
          id,
          user_id,
          full_name,
          business_name,
          phone,
          email,
          city,
          state,
          gstin,
          status,
          approved_at,
          created_at,
          updated_at,
          rejection_reason,
          suspension_reason
        `
        )
        .order('created_at', { ascending: false });

      if (hostsError) {
        throw hostsError;
      }

      setHosts(data || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to load hosts.');
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const result = {
      all: hosts.length,
      pending: 0,
      active: 0,
      suspended: 0,
      blocked: 0,
      rejected: 0,
    };

    hosts.forEach((host) => {
      if (result[host.status] !== undefined) {
        result[host.status] += 1;
      }
    });

    return result;
  }, [hosts]);

  const visibleHosts = useMemo(() => {
    if (activeTab === 'all') {
      return hosts;
    }

    return hosts.filter((host) => host.status === activeTab);
  }, [hosts, activeTab]);

  function formatDate(value) {
    if (!value) return '—';

    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatStatus(status) {
    if (!status) return 'Unknown';

    return status
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h1>Host Management</h1>
          <p className="subtitle">
            Review and manage all NightOutStays hosts from one place.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={loadHosts}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      <section className="summary-grid">
        <div className="summary-card">
          <span>Total Hosts</span>
          <strong>{counts.all}</strong>
        </div>

        <div className="summary-card">
          <span>Pending Approval</span>
          <strong>{counts.pending}</strong>
        </div>

        <div className="summary-card">
          <span>Active</span>
          <strong>{counts.active}</strong>
        </div>

        <div className="summary-card">
          <span>Suspended / Blocked</span>
          <strong>{counts.suspended + counts.blocked}</strong>
        </div>
      </section>

      <section className="hosts-panel">
        <div className="tabs">
          {statusTabs.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span>{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        {error ? (
          <div className="message error-message">{error}</div>
        ) : loading ? (
          <div className="message">Loading hosts...</div>
        ) : visibleHosts.length === 0 ? (
          <div className="empty-state">
            <h2>No hosts found</h2>
            <p>
              {activeTab === 'all'
                ? 'No host has registered yet.'
                : `There are no ${activeTab} hosts.`}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Business</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {visibleHosts.map((host) => (
                  <tr key={host.id}>
                    <td>
                      <div className="host-name">
                        {host.full_name || 'Unnamed Host'}
                      </div>
                      <div className="secondary-text">
                        {host.email || 'No email'}
                      </div>
                    </td>

                    <td>
                      <div>{host.business_name || '—'}</div>
                      {host.gstin ? (
                        <div className="secondary-text">
                          GSTIN {host.gstin}
                        </div>
                      ) : null}
                    </td>

                    <td>
                      <div>{host.phone || '—'}</div>
                    </td>

                    <td>
                      <div>
                        {[host.city, host.state]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </div>
                    </td>

                    <td>
                      <span className={`status status-${host.status}`}>
                        {formatStatus(host.status)}
                      </span>
                    </td>

                    <td>{formatDate(host.created_at)}</td>

                    <td>
                      <button
                        type="button"
                        className="view-button"
                        onClick={() => {
                          alert(
                            `Host action controls will be added in the next step.\n\nHost: ${
                              host.full_name || 'Unnamed Host'
                            }`
                          );
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f6f7f9;
          padding: 28px;
          color: #111827;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #6b7280;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.2;
        }

        .subtitle {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 15px;
        }

        .refresh-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          padding: 10px 16px;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
        }

        .summary-card span {
          display: block;
          color: #6b7280;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .summary-card strong {
          font-size: 30px;
        }

        .hosts-panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
        }

        .tabs {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          overflow-x: auto;
        }

        .tab {
          border: 0;
          background: #f3f4f6;
          color: #4b5563;
          border-radius: 999px;
          padding: 9px 13px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .tab span {
          margin-left: 6px;
          opacity: 0.7;
        }

        .tab.active {
          background: #111827;
          color: #ffffff;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 920px;
        }

        th,
        td {
          text-align: left;
          padding: 16px;
          border-bottom: 1px solid #eef0f2;
          vertical-align: middle;
        }

        th {
          background: #fafafa;
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        td {
          font-size: 14px;
        }

        .host-name {
          font-weight: 800;
        }

        .secondary-text {
          margin-top: 4px;
          color: #6b7280;
          font-size: 12px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-pending {
          background: #fff7ed;
          color: #9a3412;
        }

        .status-active {
          background: #ecfdf5;
          color: #047857;
        }

        .status-suspended {
          background: #fef3c7;
          color: #92400e;
        }

        .status-blocked,
        .status-rejected {
          background: #fef2f2;
          color: #b91c1c;
        }

        .view-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          border-radius: 8px;
          padding: 8px 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .message,
        .empty-state {
          padding: 54px 24px;
          text-align: center;
          color: #6b7280;
        }

        .empty-state h2 {
          margin: 0 0 8px;
          color: #111827;
          font-size: 20px;
        }

        .empty-state p {
          margin: 0;
        }

        .error-message {
          color: #b91c1c;
        }

        @media (max-width: 900px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 18px 12px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 27px;
          }
        }
      `}</style>
    </main>
  );
}