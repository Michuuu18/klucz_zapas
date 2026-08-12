export type UserRole = 'Admin' | 'Pracownik';

export interface AppUser {
  username: string;
  displayName: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}
