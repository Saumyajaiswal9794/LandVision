import { Schema, model, Document } from 'mongoose';

export interface UserDocument extends Document {
  supabaseId: string;
  email: string;
  name: string;
  role: 'DIGITIZER' | 'REVIEWER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    supabaseId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ['DIGITIZER', 'REVIEWER', 'ADMIN'],
      default: 'DIGITIZER',
    },
  },
  {
    timestamps: true,
  },
);

export const User = model<UserDocument>('User', UserSchema);
export default User;
