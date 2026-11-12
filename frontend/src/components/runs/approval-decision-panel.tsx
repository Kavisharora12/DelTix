"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Check,
  Copy,
  Ban,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { RunItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { useDelTixStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ApprovalDecisionPanelProps {
  run: RunItem;
  className?: string;
}

export function ApprovalDecisionPanel({ run, className }: ApprovalDecisionPanelProps) {
  const { approveRun, rejectRun } = useDelTixStore();
  const details = run.approvalDetails;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [operatorNote, setOperatorNote] = useState("Verified customer evidence & compliance policy against transaction");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signedToken, setSignedToken] = useState<string | null>(details?.signedToken || null);
  const [copied, setCopied] = useState(false);

  if (!details) return null;

  const isCurrentUserInitiator = details.initiatorIsCurrentUser ?? false;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await approveRun(run.id, operatorNote.trim() || "Approved via DelTix Console");
      setSignedToken(res.signedToken);
      setConfirmOpen(false);
    } catch (err: any) {
      setActionError(err?.message || "Failed to approve disbursement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await rejectRun(run.id, rejectReason.trim());
      setRejectOpen(false);
    } catch (err: any) {
      setActionError(err?.message || "Failed to reject disbursement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = (tok: string) => {
    navigator.clipboard.writeText(tok);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // If already approved, show signed confirmation
  if (signedToken || run.status === "COMPLETED") {
    const activeToken = signedToken || details.signedToken || "";
    return (
      <div className={cn("bg-panel border border-green-6 rounded-btn p-4 text-ui space-y-3", className)}>
        <div className="flex items-center gap-2 text-green-11 font-medium">
          <CheckCircle2 className="h-4 w-4 text-green-9" />
          <span>Payment Authorized &amp; Cryptographically Signed</span>
        </div>
        <p className="text-ui-sm text-slate-11">
          Approval recorded via Policy Service and run resumed cleanly.
        </p>
        {activeToken && (
          <div className="flex items-center justify-between p-2 rounded bg-slate-3 border border-slate-5 font-mono text-ui-xs text-slate-12">
            <span className="truncate">{activeToken}</span>
            <button
              type="button"
              onClick={() => handleCopyToken(activeToken)}
              className="text-slate-10 hover:text-slate-12 ml-2"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-11" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    );
  }

  // If already rejected
  if (run.status === "REJECTED") {
    return (
      <div className={cn("bg-panel border border-red-6 rounded-btn p-4 text-ui space-y-2", className)}>
        <div className="flex items-center gap-2 text-red-11 font-medium">
          <Ban className="h-4 w-4 text-red-9" />
          <span>Disbursement Rejected</span>
        </div>
        <p className="text-ui-sm text-slate-11">{run.failureReason}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-panel border border-amber-6 rounded-btn overflow-hidden text-ui select-none", className)}>
      {/* 1. Amber Banner Row */}
      <div className="px-4 py-2.5 bg-amber-3 border-b border-amber-6 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-9 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-amber-12">Waiting for approval</div>
          <div className="text-ui-sm text-amber-11 mt-0.5">{details.reason}</div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 2. What will happen (Plain definition list) */}
        <div>
          <div className="text-ui-xs text-slate-10 uppercase tracking-wider font-semibold mb-2">
            What will happen
          </div>
          <div className="p-3 bg-slate-3 rounded-btn border border-slate-5 space-y-2 text-ui-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-10">Release Payment</span>
              <Money cents={details.amountCents} currency={run.currency} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-10">Recipient</span>
              <span className="text-slate-12 font-medium">{details.recipientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-10">PayPal ID</span>
              <span className="font-mono text-ui-xs text-slate-11">{details.recipientAccount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-10">Debit Account</span>
              <span className="text-slate-11">{details.sourceAccount}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-5">
              <span className="text-slate-10">Dispatch Timing</span>
              <span className="text-slate-11">Immediately upon dual-key signature</span>
            </div>
          </div>
        </div>

        {/* 3. Checks Passed List */}
        <div>
          <div className="text-ui-xs text-slate-10 uppercase tracking-wider font-semibold mb-2">
            Completed pre-gate steps
          </div>
          {details.checksPassed.length > 0 ? (
            <ul className="space-y-1.5 text-ui-sm">
              {details.checksPassed.map((chk, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-11">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-11 shrink-0 mt-0.5" />
                  <span className="font-mono text-ui-xs">{chk}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-ui-xs text-slate-9 font-mono">
              Paused at initial gate check.
            </div>
          )}
        </div>

        {actionError && (
          <div className="p-2.5 rounded bg-red-2 border border-red-6 text-ui-xs text-red-11">
            {actionError}
          </div>
        )}

        {/* 4. Rule that Triggered (Mono expression) */}
        <div>
          <div className="text-ui-xs text-slate-10 uppercase tracking-wider font-semibold mb-1.5">
            Rule that triggered pause
          </div>
          <div className="p-2 rounded bg-slate-3 border border-slate-5 font-mono text-ui-xs text-amber-11">
            {details.triggeredRule}
          </div>
        </div>

        {/* Separation of duties warning */}
        {isCurrentUserInitiator && (
          <div className="p-2.5 rounded bg-slate-4 border border-slate-6 text-ui-xs text-slate-11 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-10" />
            <span>You started this run. Another authorized controller must sign.</span>
          </div>
        )}

        {/* 5. Actions: Reject and Approve */}
        <div className="pt-2 border-t border-slate-5 flex items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            size="default"
            onClick={() => setRejectOpen(true)}
            disabled={isSubmitting}
          >
            Reject
          </Button>

          <Button
            variant="primary"
            size="default"
            disabled={isCurrentUserInitiator || isSubmitting}
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5"
          >
            <span>Approve</span>
            <Money cents={details.amountCents} currency={run.currency} showCurrency={false} />
          </Button>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-panel border border-slate-5 rounded-panel p-5 space-y-4 shadow-floating">
            <div className="flex items-center gap-2 text-title-section text-slate-12">
              <ShieldCheck className="h-5 w-5 text-blue-9" />
              <span>Confirm & Authorize Disbursement</span>
            </div>

            <p className="text-ui text-slate-11">
              You are about to sign and release a live payment of{" "}
              <strong className="text-slate-12">
                ${(details.amountCents / 100).toFixed(2)} USD
              </strong>{" "}
              to <strong className="text-slate-12">{details.recipientName}</strong>.
            </p>

            <div className="p-3 bg-slate-3 border border-slate-5 rounded-btn text-ui-xs space-y-1 font-mono text-slate-10">
              <div>TARGET_ACCOUNT: {details.recipientAccount}</div>
              <div>IDEMPOTENCY_MODE: ENFORCE_PRE_RECORDED</div>
              <div>AUTH_MECHANISM: HMAC_SHA256_DUAL_KEY</div>
            </div>

            <div>
              <label className="block text-ui-xs font-semibold text-slate-11 uppercase tracking-wider mb-1.5">
                Compliance Operator Note (Immutable Audit Trail)
              </label>
              <textarea
                value={operatorNote}
                onChange={(e) => setOperatorNote(e.target.value)}
                placeholder="Enter justification (e.g. Verified customer photo evidence. Authorized by Support Lead)..."
                rows={3}
                className="w-full p-2.5 bg-slate-2 border border-slate-5 rounded-btn text-ui-sm text-slate-12 placeholder:text-slate-10 focus:outline-none focus:border-slate-8 resize-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-5">
              <Button
                variant="secondary"
                size="default"
                onClick={() => setConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="default"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing..." : "Sign and release payment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-panel border border-slate-5 rounded-panel p-5 space-y-4 shadow-floating">
            <div className="flex items-center gap-2 text-title-section text-red-11">
              <Ban className="h-5 w-5 text-red-9" />
              <span>Reject Disbursement</span>
            </div>

            <p className="text-ui text-slate-11">
              State the reason for rejecting this payout. This will be recorded permanently in the tamper-proof audit trail.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Rate card variance exceeds contractual agreement; vendor invoice mismatch."
              rows={3}
              className="w-full p-2.5 bg-slate-3 border border-slate-5 rounded-btn text-ui text-slate-12 placeholder:text-slate-10 focus:outline-none focus:border-slate-7 resize-none"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-5">
              <Button
                variant="secondary"
                size="default"
                onClick={() => setRejectOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="default"
                onClick={handleReject}
                disabled={!rejectReason.trim() || isSubmitting}
              >
                {isSubmitting ? "Rejecting..." : "Reject payout"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

