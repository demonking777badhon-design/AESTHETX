import React, { useEffect, useState } from 'react';
import { History, Shield, Clock } from 'lucide-react';
import { getAuditLogs } from '../../firebase/db';
import type { AuditLog } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLogs(60).then(setLogs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Security & Audit Logs</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Immutable administrative action history recorded in Firestore for accountability.
          </p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : logs.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Admin Identity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE5]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3 px-4 text-[#626C66] whitespace-nowrap">
                    {log.timestamp?.seconds
                      ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                      : 'Just now'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-[#1E3A2F] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E5DFD7]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#1A1E1C]">
                    {log.target}
                  </td>
                  <td className="py-3 px-4 text-[#626C66]">
                    {log.details || '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#626C66]">
                    {log.adminEmail || log.adminUid}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
          <History className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Audit Entries Recorded</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            Audit logs will be generated automatically as administrative modifications take place.
          </p>
        </div>
      )}
    </div>
  );
};
