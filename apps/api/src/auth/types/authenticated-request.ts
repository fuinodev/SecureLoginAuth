
export interface AuthenticatedUser {
  id: string;
  sessionId: string;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
}
