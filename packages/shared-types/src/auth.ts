import type { Customer } from "./customer";

export interface AuthSuccessResponse {
  customer: Customer;
  accessToken: string;
}
