import { Schema, model, Document, Types } from 'mongoose';
import { ReviewStatus } from '@landvision/types';

export interface ReviewQueueDocument extends Document {
  recordId: Types.ObjectId;
  assignedTo: string | null; // Supabase user ID
  status: ReviewStatus;
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReviewQueueSchema = new Schema<ReviewQueueDocument>(
  {
    recordId: { type: Schema.Types.ObjectId, ref: 'LandRecord', required: true, unique: true },
    assignedTo: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    notes: [{ type: String }],
  },
  {
    timestamps: true,
  },
);

export const ReviewQueue = model<ReviewQueueDocument>('ReviewQueue', ReviewQueueSchema);
export default ReviewQueue;
