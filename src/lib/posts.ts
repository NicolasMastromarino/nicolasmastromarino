import { getSupabaseServerClient } from "@/lib/supabase";

export type Post = {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  content: string;
  published_at: string;
  meta_title: string | null;
  meta_description: string | null;
};

export async function getPosts(locale: string): Promise<Post[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("locale", locale)
    .order("published_at", { ascending: false });

  if (error || !data) return [];
  return data as Post[];
}

export async function getPost(locale: string, slug: string): Promise<Post | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("locale", locale)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as Post;
}
