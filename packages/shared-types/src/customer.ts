export type CustomerType = "private" | "wholesale";

export type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  customer_type: CustomerType;
  created_at: string;
  last_login?: string;
};
