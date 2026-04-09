export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: Address;
  createdAt: string;
}

export interface Address {
  street: string;
  city: string;
  postalCode?: string;
  country: string;
}
