// Fire-and-forget audit logging. Never throws, never blocks user flow.
// Queries are read-only via SQL editor in Supabase (no UI in app).
import { supabasePublic } from '@/integrations/supabase/client';
import { getCurrentEnv } from '@/lib/envState';

interface LogOptions {
  /**
   * Override the staging flag explicitly. Use for events (e.g. auth.login)
   * fired before the env has resolved from the user's profile — at that
   * point getCurrentEnv() still returns 'production' and would mis-stamp
   * staging users' actions.
   */
  isStaging?: boolean;
}

export async function logActivity(
  action: string,
  entityType?: string | null,
  entityId?: string | null,
  details?: Record<string, unknown>,
  options?: LogOptions,
): Promise<void> {
  try {
    const { data: { user } } = await supabasePublic.auth.getUser();
    if (!user) return; // RLS requires authenticated user
    const isStaging = options?.isStaging ?? (getCurrentEnv() === 'staging');
    await supabasePublic.from('activity_log' as any).insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: details ?? {},
      is_staging: isStaging,
    });
  } catch (err) {
    console.warn('[activityLog] failed', err);
  }
}
