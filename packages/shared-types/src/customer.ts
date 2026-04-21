export type CustomerType = "private" | "wholesale";

export type CustomerRole = "customer" | "admin";

export type CustomerStatus = "active" | "suspended";

export type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  customer_type: CustomerType;
  role: CustomerRole;
  status: CustomerStatus;
  created_at: string;
  last_login?: string;
};
