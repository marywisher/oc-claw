export type SystemRunApprovalRejectionReason = 
  | "SOUL_CHECK"      // SOUL.md 治理检查拒绝
  | "CODE_CHECK"      // 代码层权限拒绝
  | "SAFE_MODE"       // safeMode 限制拒绝
  | "APPROVAL";       // 审批/验证拒绝（通用）

export type SystemRunApprovalGuardError = {
  ok: false;
  message: string;
  details: Record<string, unknown>;
  userMessage?: string;          // 用户友好说明（无技术术语）
  rejectionReason?: SystemRunApprovalRejectionReason;
};

export function systemRunApprovalGuardError(params: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  userMessage?: string;
  rejectionReason?: SystemRunApprovalRejectionReason;
}): SystemRunApprovalGuardError {
  const details = params.details ? { ...params.details } : {};
  return {
    ok: false,
    message: params.message,
    details: {
      code: params.code,
      ...details,
    },
    ...(params.userMessage && { userMessage: params.userMessage }),
    ...(params.rejectionReason && { rejectionReason: params.rejectionReason }),
  };
}

export function systemRunApprovalRequired(runId: string): SystemRunApprovalGuardError {
  return systemRunApprovalGuardError({
    code: "APPROVAL_REQUIRED",
    message: "approval required",
    details: { runId },
  });
}
