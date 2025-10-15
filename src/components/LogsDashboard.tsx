import { useEffect, useState } from 'react';
import { Power, Loader2, Mail, AlertCircle } from 'lucide-react';
import { supabase, type EmailLog, getSupabaseUrl, getSupabaseAnonKey } from '../lib/supabase';

interface WorkflowStatus {
  active: boolean;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function LogsDashboard() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  const fetchWorkflowStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('n8n-proxy', {
        body: { action: 'status' },
      });

      if (error) throw error;

      const payload = data as WorkflowStatus;
      setIsActive(Boolean(payload?.active));
      setError(null);
    } catch (err) {
      setError('Unable to connect to n8n workflow.');
      console.error('Error fetching workflow status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const activateWorkflow = async () => {
    setIsToggling(true);
    try {
      const { error } = await supabase.functions.invoke('n8n-proxy', {
        body: { action: 'activate' },
      });
      if (error) throw error;
      setIsActive(true);
      showToast('Automation activated successfully', 'success');
    } catch (err) {
      showToast('Failed to activate automation', 'error');
      console.error('Error activating workflow:', err);
    } finally {
      setIsToggling(false);
    }
  };

  const deactivateWorkflow = async () => {
    setIsToggling(true);
    try {
      const { error } = await supabase.functions.invoke('n8n-proxy', {
        body: { action: 'deactivate' },
      });
      if (error) throw error;
      setIsActive(false);
      showToast('Automation deactivated successfully', 'success');
    } catch (err) {
      showToast('Failed to deactivate automation', 'error');
      console.error('Error deactivating workflow:', err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggle = () => {
    if (isActive) deactivateWorkflow();
    else activateWorkflow();
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      showToast('Failed to load email logs', 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('email_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_logs',
        },
        (payload) => {
          const row = payload.new as EmailLog;
          setLogs((current) => [row, ...current].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (supabaseUrl && supabaseKey) {
      fetchWorkflowStatus();
    } else {
      setError('Missing Supabase configuration.');
      setIsLoadingStatus(false);
    }
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimestamp = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('sent') || statusLower.includes('success')) return 'bg-green-100 text-green-800';
    if (statusLower.includes('fail') || statusLower.includes('error')) return 'bg-red-100 text-red-800';
    if (statusLower.includes('pending')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-8 h-8 text-slate-700" />
            <h1 className="text-3xl font-bold text-slate-900">Email Automation Dashboard</h1>
          </div>
          <p className="text-slate-600">Monitor and control your n8n email reminder workflow</p>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 transition-all ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${isActive ? 'bg-green-100' : 'bg-slate-100'}`}>
                <Power className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Automation Status</h2>
                <p className="text-sm text-slate-600">
                  {isLoadingStatus ? 'Loading...' : isActive ? 'Currently running' : 'Currently stopped'}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={handleToggle}
              disabled={isToggling || isLoadingStatus || !!error}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive ? 'bg-green-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${
                  isActive ? 'translate-x-7' : 'translate-x-1'
                }`}
              >
                {isToggling && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-600 absolute inset-1" />
                )}
              </span>
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 mb-1">Connection Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Email Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Recent Email Logs</h2>
            <p className="text-sm text-slate-600 mt-1">Latest 50 emails sent by the automation</p>
          </div>

          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No email logs yet</p>
              <p className="text-sm text-slate-500 mt-1">Logs will appear here once emails are sent</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Target Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Sent At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log, index) => (
                    <tr key={log.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{log.recipient}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.email_type || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 max-w-xs truncate">{log.subject || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(log.target_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatTimestamp(log.timestamp)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>Powered by n8n and Supabase • Updates in real-time</p>
        </div>
      </div>
    </div>
  );
}

