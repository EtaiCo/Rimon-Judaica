declare global {
  namespace Express {
    interface Request {
      customerId?: string;
    }
  }
}

export {};
