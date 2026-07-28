export type UserRole = 'ADMIN' | 'USER' | 'SUPER_ADMIN';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
