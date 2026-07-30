// Fire-and-forget audit logging. Never throws, never blocks user flow.
// Queries are read-only via SQL editor in Supabase (no UI in app).
//
// `is_staging` é sempre false: o schema staging foi depreciado e não há mais
// alternância de ambiente. A coluna permanece no banco pelo valor histórico.
import { supabasePublic } from '@/integrations/supabase/client';

export async function logActivity(
  action: string,
  entityType?: string | null,
  entityId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabasePublic.auth.getUser();
    if (!user) return; // RLS requires authenticated user
    await supabasePublic.from('activity_log' as any).insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: details ?? {},
      is_staging: false,
    });
  } catch (err) {
    console.warn('[activityLog] failed', err);
  }
}
