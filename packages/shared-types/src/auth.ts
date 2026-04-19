import type { Customer } from "./customer";

export type AuthSuccessResponse = {
  customer: Customer;
  accessToken: string;
};
