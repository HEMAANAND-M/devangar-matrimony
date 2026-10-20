/** Human wording for AdminLog actions. Unknown actions fall back to a tidied version of the key. */
const LABELS: Record<string, string> = {
  "profile.approve": "Approved profile",
  "profile.reject": "Rejected profile",
  "profile.status": "Changed profile status",
  "profile.edit": "Edited profile",
  "profile.married": "Marked as married",
  "photo.approve": "Approved photo",
  "photo.reject": "Rejected photo",
  "report.dismiss": "Dismissed report",
  "report.remove_profile": "Removed reported profile",
  "id.approve": "Approved ID",
  "id.reject": "Rejected ID",
  "member.suspend": "Suspended account",
  "member.ban": "Banned account",
  "member.reactivate": "Reactivated account",
  "member.force_logout": "Signed member out",
  "member.reset_password": "Reset password",
  "member.reveal_phone": "Viewed phone number",
  "member.notes": "Updated staff notes",
  "member.grant_premium": "Granted premium",
  "member.export": "Exported member data",
  "member.erase": "Erased account",
  "member.bulk_approve": "Bulk-approved profiles",
  "staff.add_moderator": "Added moderator",
  "staff.remove_moderator": "Removed moderator",
  "staff.promote_admin": "Promoted to admin",
  "staff.demote_admin": "Demoted admin",
  "export.members": "Exported members CSV",
  "export.activity": "Exported activity CSV",
};

export function actionLabel(action: string): string {
  if (LABELS[action]) return LABELS[action];
  const text = action.replace(".", " · ").replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ACTION_GROUPS: [prefix: string, label: string][] = [
  ["profile.", "Profiles"],
  ["photo.", "Photos"],
  ["report.", "Reports"],
  ["id.", "Verifications"],
  ["member.", "Member accounts"],
  ["payment.", "Payments"],
  ["staff.", "Staff"],
  ["export.", "Exports"],
];
