import { getBearerToken, isAllowedOrigin, setCors } from '../../api/_shared/apiHelpers.js';
import { computeForlangningOfferFromProfile } from '../../api/_shared/paymentDomain.js';
import { getSupabaseAdmin, resolveAuthUser } from '../../api/_shared/paymentHelpers.js';

type ProfileRow = {
  id: string;
  email: string | null;
  coaching_expires_at: string | null;
};

type PendingEntitlementRow = {
  id: string;
  entitlement_type: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

async function getProfile(admin: any, id: string): Promise<ProfileRow | null> {
  try {
    const { data } = await admin
      .from('profiles')
      .select('id,email,coaching_expires_at')
      .eq('id', id)
      .limit(1)
      .maybeSingle()
      .throwOnError();
    if (!data?.id) return null;
    return {
      id: String(data.id),
      email: typeof data.email === 'string' ? data.email : null,
      coaching_expires_at: typeof data.coaching_expires_at === 'string' ? data.coaching_expires_at : null,
    };
  } catch {
    return null;
  }
}

async function markResolved(admin: any, entitlementId: string) {
  await admin
    .from('stripe_pending_entitlements')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entitlementId)
    .eq('status', 'pending')
    .throwOnError();
}

async function applyPendingEntitlement(admin: any, profile: ProfileRow, entitlement: PendingEntitlementRow): Promise<boolean> {
  if (entitlement.entitlement_type === 'premium') {
    await admin
      .from('profiles')
      .update({
        membership_level: 'premium',
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .throwOnError();
    await markResolved(admin, entitlement.id);
    return true;
  }

  if (entitlement.entitlement_type === 'forlangning') {
    const offer = computeForlangningOfferFromProfile(profile.coaching_expires_at);
    if (offer.totalPrice <= 0 || offer.monthCount <= 0) {
      return false;
    }

    await admin
      .from('profiles')
      .update({
        coaching_expires_at: offer.newExpiresAt,
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .throwOnError();
    await markResolved(admin, entitlement.id);
    return true;
  }

  await markResolved(admin, entitlement.id);
  return false;
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  if (!isAllowedOrigin(origin)) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const accessToken = getBearerToken(req.headers?.authorization as string | undefined);
  const authUser = await resolveAuthUser(accessToken);
  if (!authUser?.id) {
    setCors(res, origin);
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    setCors(res, origin);
    res.status(500).json({ error: 'Supabase admin is not configured' });
    return;
  }

  const profile = await getProfile(admin, authUser.id);
  if (!profile) {
    setCors(res, origin);
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const normalizedEmail = (profile.email || authUser.email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    setCors(res, origin);
    res.status(400).json({ error: 'User email is required to claim entitlements' });
    return;
  }

  try {
    const { data } = await admin
      .from('stripe_pending_entitlements')
      .select('id, entitlement_type, payload, created_at')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .throwOnError();

    const rows = ((data as PendingEntitlementRow[] | null) || []).filter((row) => row && row.id);
    if (!rows.length) {
      setCors(res, origin);
      res.status(200).json({ ok: true, resolved_count: 0, applied: [] });
      return;
    }

    let refreshedProfile: ProfileRow = profile;
    const applied: string[] = [];
    for (const row of rows) {
      const didApply = await applyPendingEntitlement(admin, refreshedProfile, row);
      if (didApply) {
        applied.push(row.entitlement_type);
      }
      const nextProfile = await getProfile(admin, authUser.id);
      if (nextProfile) {
        refreshedProfile = nextProfile;
      }
    }

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      resolved_count: rows.length,
      applied,
    });
  } catch (error: any) {
    console.error('claim-pending-entitlements failed', error);
    setCors(res, origin);
    res.status(500).json({ error: error?.message || 'Could not claim pending entitlements' });
  }
}
