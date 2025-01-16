import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    id: number; // or number, depending on your user ID type
    email: string;
    // Add other user properties as needed
  };
}