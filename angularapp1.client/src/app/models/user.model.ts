export type UserRole = 'Admin' | 'Pracownik';

export interface AppUser {
  token: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}
