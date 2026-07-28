import { User } from './user.model';

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
