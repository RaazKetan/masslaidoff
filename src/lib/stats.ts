import { requireSupabase } from './supabase';
import type { PublicMetricsDaily } from './types';

/** Get the latest public platform metrics */
export async function getLatestMetrics(): Promise<PublicMetricsDaily | null> {
  const { data } = await requireSupabase()
    .from('public_platform_metrics')
    .select('*')
    .order('metric_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Get metrics over a date range for trend charts */
export async function getMetricsTrend(
  startDate: string,
  endDate?: string,
): Promise<PublicMetricsDaily[]> {
  let query = requireSupabase()
    .from('public_platform_metrics')
    .select('*')
    .gte('metric_date', startDate)
    .order('metric_date', { ascending: true });

  if (endDate) {
    query = query.lte('metric_date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Get live aggregate counts (computed on the fly for MVP) */
export async function getLiveStats(): Promise<{
  totalPublished: number;
  totalVerified: number;
  companiesRepresented: number;
  roleDistribution: Record<string, number>;
  locationDistribution: Record<string, number>;
  experienceDistribution: Record<string, number>;
  remoteAvailable: number;
}> {
  const client = requireSupabase();

  // Total published
  const { count: totalPublished } = await client
    .from('candidate_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('visibility', 'published');

  // Total verified
  const { count: totalVerified } = await client
    .from('candidate_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('visibility', 'published')
    .eq('verification_status', 'verified');

  // Unique companies from published profiles
  const { data: companyData } = await client
    .from('candidate_directory')
    .select('latest_company');

  const uniqueCompanies = new Set(
    (companyData ?? []).map((r) => r.latest_company).filter(Boolean),
  );

  // Role distribution (from published profiles)
  const { data: roleData } = await client
    .from('candidate_directory')
    .select('discipline');

  const roleDistribution: Record<string, number> = {};
  (roleData ?? []).forEach((r) => {
    const d = r.discipline || 'Other';
    roleDistribution[d] = (roleDistribution[d] || 0) + 1;
  });

  // Location distribution
  const { data: locData } = await client
    .from('candidate_directory')
    .select('location');

  const locationDistribution: Record<string, number> = {};
  (locData ?? []).forEach((r) => {
    const l = r.location || 'Unknown';
    locationDistribution[l] = (locationDistribution[l] || 0) + 1;
  });

  // Experience distribution
  const { data: expData } = await client
    .from('candidate_directory')
    .select('years_experience');

  const experienceDistribution: Record<string, number> = {
    '0–4 years': 0,
    '5–8 years': 0,
    '9–14 years': 0,
    '15+ years': 0,
  };
  (expData ?? []).forEach((r) => {
    const y = r.years_experience ?? 0;
    if (y <= 4) experienceDistribution['0–4 years']++;
    else if (y <= 8) experienceDistribution['5–8 years']++;
    else if (y <= 14) experienceDistribution['9–14 years']++;
    else experienceDistribution['15+ years']++;
  });

  // Remote availability
  const { count: remoteAvailable } = await client
    .from('candidate_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('visibility', 'published')
    .eq('open_to_remote', true);

  return {
    totalPublished: totalPublished ?? 0,
    totalVerified: totalVerified ?? 0,
    companiesRepresented: uniqueCompanies.size,
    roleDistribution,
    locationDistribution,
    experienceDistribution,
    remoteAvailable: remoteAvailable ?? 0,
  };
}
