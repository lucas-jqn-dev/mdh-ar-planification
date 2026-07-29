import { User } from './user.model';

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  signupCode: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
