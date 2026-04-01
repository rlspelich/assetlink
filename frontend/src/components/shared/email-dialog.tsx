import { useState } from 'react';
import { X, Send, Loader2, AlertCircle, CheckCircle2, Mail, ChevronDown } from 'lucide-react';
import { useUsersList } from '../../hooks/use-users';
import type { User } from '../../api/types';

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "Work Order WO-20260322-002" or "Inspection INS-20260322-001" */
  itemLabel: string;
  /** Short description for the subject line preview */
  itemDescription: string | null;
  onSend: (data: { to: string; cc?: string; message?: string }) => Promise<{
    status: string;
    subject: string;
    preview_html: string | null;
  }>;
}

export function EmailDialog({
  open,
  onClose,
  itemLabel,
  itemDescription,
  onSend,
}: EmailDialogProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ status: string; subject: string } | null>(null);
  const [showCc, setShowCc] = useState(false);

  // Fetch users for the picker
  const { data: usersData } = useUsersList({ is_active: true });
  const users = usersData?.users ?? [];

  if (!open) return null;

  const subjectPreview = itemDescription
    ? `${itemLabel} \u2014 ${itemDescription.slice(0, 60)}${itemDescription.length > 60 ? '...' : ''}`
    : itemLabel;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = to.trim() !== '' && isValidEmail(to.trim()) && !sending;

  const handleSelectUser = (user: User) => {
    setTo(user.email);
  };

  const handleSelectCcUser = (user: User) => {
    setCc(user.email);
  };

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      const result = await onSend({
        to: to.trim(),
        cc: cc.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSuccess({ status: result.status, subject: result.subject });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setTo('');
    setCc('');
    setMessage('');
    setError(null);
    setSuccess(null);
    setShowCc(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" role="presentation" onClick={handleClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Email {itemLabel}
            </h3>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">
              {success.status === 'sent' ? 'Email Sent' : 'Email Queued'}
            </p>
            <p className="text-xs text-gray-500 mb-1">{success.subject}</p>
            {success.status === 'preview' && (
              <p className="text-xs text-amber-600 mt-2">
                SMTP is not configured. Email was logged for preview.
              </p>
            )}
            <button
              onClick={handleClose}
              className="mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 space-y-3">
              {/* From display */}
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">From</div>
                <div className="text-xs text-gray-700">
                  AssetLink &lt;workorders@assetlink.us&gt;
                </div>
              </div>

              {/* Subject preview */}
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Subject</div>
                <div className="text-xs text-gray-700 truncate">{subjectPreview}</div>
              </div>

              {/* To — user picker + manual entry */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  To <span className="text-red-500">*</span>
                </label>
                {users.length > 0 ? (
                  <div className="space-y-2">
                    {/* User picker dropdown */}
                    <div className="relative">
                      <select
                        value=""
                        onChange={(e) => {
                          const user = users.find((u) => u.user_id === e.target.value);
                          if (user) handleSelectUser(user);
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                      >
                        <option value="">Select team member...</option>
                        {users.map((u) => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.full_name} — {u.email} ({u.role})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {/* Show selected or allow manual */}
                    <input
                      type="email"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="Or type an email address"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <input
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                )}
              </div>

              {/* CC toggle + field */}
              {!showCc ? (
                <button
                  onClick={() => setShowCc(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Add CC
                </button>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CC</label>
                  {users.length > 0 ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value=""
                          onChange={(e) => {
                            const user = users.find((u) => u.user_id === e.target.value);
                            if (user) handleSelectCcUser(user);
                          }}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select team member...</option>
                          {users.map((u) => (
                            <option key={u.user_id} value={u.user_id}>
                              {u.full_name} — {u.email} ({u.role})
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <input
                        type="email"
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        placeholder="Or type an email address"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <input
                      type="email"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="cc@example.com"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Message (optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Additional notes for the recipient..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
