import { useState } from 'react';
import { X, Send, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';

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

  if (!open) return null;

  const subjectPreview = itemDescription
    ? `${itemLabel} \u2014 ${itemDescription.slice(0, 60)}${itemDescription.length > 60 ? '...' : ''}`
    : itemLabel;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const canSend = to.trim() !== '' && isValidEmail(to.trim()) && !sending;

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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />

      {/* Dialog */}
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
            <p className="text-xs text-gray-500 mb-1">
              {success.subject}
            </p>
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
            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {/* Subject preview */}
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                  Subject
                </div>
                <div className="text-xs text-gray-700 truncate">
                  {subjectPreview}
                </div>
              </div>

              {/* To */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  To <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="crewlead@springfield.gov"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* CC */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">CC</label>
                <input
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="supervisor@springfield.gov"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Additional notes for the recipient..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
