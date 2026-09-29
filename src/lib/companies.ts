import { requireSupabase } from './supabase';
import type { Company } from './types';

/** Search companies by name (for autocomplete) */
export async function searchCompanies(query: string, limit = 10): Promise<Company[]> {
  if (!query || query.length < 2) return [];

  const { data, error } = await requireSupabase()
    .from('companies')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Get a company by ID */
export async function getCompany(id: string): Promise<Company | null> {
  const { data } = await requireSupabase()
    .from('companies')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data;
}

/** Get or create a company by name */
export async function getOrCreateCompany(name: string, industry?: string): Promise<Company> {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Try to find existing
  const { data: existing } = await requireSupabase()
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing;

  // Create new
  const { data, error } = await requireSupabase()
    .from('companies')
    .insert({
      name: name.trim(),
      slug,
      industry: industry || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** List all companies (for filter dropdowns) */
export async function listCompanies(limit = 100): Promise<Company[]> {
  const { data, error } = await requireSupabase()
    .from('companies')
    .select('*')
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
