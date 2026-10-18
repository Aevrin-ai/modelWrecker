export interface Account {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  organization: string;
  avatarInitials: string;
  createdAt: string;
  signInProvider: "google"; // docs/security/authentication.md
}

// the local engine reads the sync settings; evidence and transcripts stay local unless switched on
export interface WorkspaceSettings {
  sync: {
    metadata: true; // summary metadata is required for the dashboard
    detailedEvidence: boolean;
    transcripts: boolean;
  };
  notifications: Record<NotificationItem["kind"], boolean>;
}

export interface NotificationItem {
  id: string;
  kind:
    | "campaign_completed"
    | "critical_finding"
    | "device_connected"
    | "device_disconnected"
    | "sync_failed"
    | "new_version"
    | "subscription_changed";
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
}

export interface SearchResult {
  id: string;
  kind: "project" | "target" | "campaign" | "finding" | "device" | "report";
  title: string;
  subtitle: string;
  href: string;
}
