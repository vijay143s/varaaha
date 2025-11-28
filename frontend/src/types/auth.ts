export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  role: "customer" | "admin";
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}
