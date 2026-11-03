
export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
}
