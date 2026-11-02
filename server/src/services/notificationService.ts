import { Notification } from '../models/Notification';
import { User } from '../models/User';

export type NotificationType =
  | 'review_requested'
  | 'review_completed'
  | 'extraction_failed'
  | 'extraction_complete';

/**
 * Creates a notification for a single user. Never throws — notifications are
 * a side-effect and must not break the main flow.
 */
export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!params.userId) return;
    await Notification.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      read: false,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.warn('[Notifications] Failed to create notification:', err);
  }
}

/**
 * Creates a notification for every user holding one of the given roles
 * (e.g. notify all reviewers/admins that a document needs review).
 * Never throws.
 */
export async function notifyRole(
  roles: Array<'officer' | 'reviewer' | 'admin'>,
  params: Omit<Parameters<typeof notifyUser>[0], 'userId'>,
): Promise<void> {
  try {
    const users = await User.findByRoles(roles);
    if (!users.length) return;
    await Notification.insertMany(
      users.map((u) => ({
        userId: u.supabaseId,
        type: params.type,
        title: params.title,
        message: params.message,
        read: false,
        metadata: params.metadata ?? null,
      })),
    );
  } catch (err) {
    console.warn('[Notifications] Failed to create role notifications:', err);
  }
}
