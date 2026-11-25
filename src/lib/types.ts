export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  phone: string;
  language: string;
  timezone: string;
  autoTimezone: boolean;
  twoFactorEnabled: boolean;
  passwordChangedAt: string;
  notifyDocChanges: boolean;
  notifyStorageLimit: boolean;
}

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  projectCode: string;
  status: string;
  projectType: string;
  storageLocation: string;
  themeColor: string;
  logoUrl: string | null;
  loginBgUrl: string | null;
  customInvitations: boolean;
  autoIndexing: boolean;
  versioning: boolean;
  publishing: boolean;
  supportAccess: boolean;
  twoFactorRequired: boolean;
  allowedDomains: string;
  allowedIps: string;
  emailVerification: boolean;
  aiToolsEnabled: boolean;
  aiRedaction: boolean;
  aiSearch: boolean;
  aiTranslation: boolean;
  aiSimilarQna: boolean;
  watermarkEnabled: boolean;
  watermarkOnView: boolean;
  watermarkOnPrint: boolean;
  watermarkOnDownload: boolean;
  watermarkColor: string;
  watermarkOpacity: number;
  watermarkPosition: string;
  watermarkFieldsJson: string;
  watermarkCustomText: string;
  driveRootFolderId: string;
  driveRootFolderName: string;
  driveAuthMode: string;
  driveServiceAccountJson: string;
  driveOAuthTokensJson: string;
  driveApiKey: string;
  lastSyncedAt: string | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
  autoSyncIntervalMin: number;
  exclusionPatterns: string;
  adminEmail: string;
  adminPhone: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupDto {
  id: string;
  projectId: string;
  name: string;
  role: string;
  isDefaultAdmin: boolean;
  accessEnabled: boolean;
  accessStart: string | null;
  accessEnd: string | null;
  require2fa: boolean;
  allowedIps: string;
  featurePermissionsJson: string;
  aiIntegrationsJson: string;
  docNotifications: boolean;
  docUpdateFrequency: string;
  isDeleted: boolean;
  members?: Array<{ id: string; firstName: string; lastName: string; email: string; status: string }>;
}

export interface DriveNodeDto {
  id: string;
  projectId: string;
  driveFileId: string;
  parentDriveId: string | null;
  name: string;
  isFolder: boolean;
  mimeType: string;
  extension: string;
  category: string;
  sizeBytes: number;
  pageCount: number;
  dotIndex: string;
  sortOrder: number;
  driveWebViewLink: string | null;
  driveModifiedAt: string;
  driveCreatedAt: string;
  isPublished: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  isRedacted: boolean;
  redactionStatus: string;
  effectivePermission: string;
  notesCount: number;
  isFavorite: boolean;
  viewedByMe: boolean;
  lastViewedAt: string | null;
  subfolderCount: number;
  fileCount: number;
  totalBytes: number;
  labels: Array<{ id: string; groupName: string; value: string }>;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: UserDto;
  project?: ProjectDto;
  actualGroup?: GroupDto;
  effectiveGroup?: GroupDto;
  isViewingAs?: boolean;
  isAdmin?: boolean;
  isTrueAdmin?: boolean;
  pendingTerms?: Array<{ id: string; title: string; type: string; displayMode: string; content: string }>;
  allProjects?: Array<{ id: string; name: string; slug: string; status: string; isFavorite: boolean; updatedAt: string }>;
  groups?: GroupDto[];
}
