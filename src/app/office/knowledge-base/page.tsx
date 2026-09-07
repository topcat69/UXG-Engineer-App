import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { humanize } from "@/lib/format/text";
import { CategoryManager } from "./category-manager";
import { CreateArticleForm } from "./create-article-form";

function statusVariant(status: string): "secondary" | "outline" | "destructive" {
  if (status === "pending_review") return "outline";
  if (status === "declined") return "destructive";
  return "secondary";
}

export default async function KnowledgeBasePage() {
  const supabase = await createClient();

  const [{ data: articles }, { data: categories }, { data: manufacturers }, { data: modelRanges }] = await Promise.all([
    supabase
      .from("kb_articles")
      .select(
        "id, title, status, created_at, category:kb_categories(name), manufacturer:kb_manufacturers(name), model_range:kb_model_ranges(name), author:users!kb_articles_author_id_fkey(name)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("kb_categories").select("*").order("name"),
    supabase.from("kb_manufacturers").select("*").order("name"),
    supabase.from("kb_model_ranges").select("*").order("name"),
  ]);

  const pendingCount = (articles ?? []).filter((a) => a.status === "pending_review").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm">
          Office content publishes directly. Engineer submissions go to review first — approve to publish, or
          decline with a reason the engineer can see and act on.
        </p>
      </div>

      <CreateArticleForm categories={categories ?? []} manufacturers={manufacturers ?? []} modelRanges={modelRanges ?? []} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">Articles</h2>
          {pendingCount > 0 && <Badge variant="outline">{pendingCount} pending review</Badge>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-medium">Title</th>
              <th className="py-2 font-medium">Category</th>
              <th className="py-2 font-medium">Author</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {(articles ?? []).map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2">
                  <Link href={`/office/knowledge-base/${a.id}`} className="font-medium hover:underline">
                    {a.title}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">
                  {[a.category?.name, a.manufacturer?.name, a.model_range?.name].filter(Boolean).join(" > ") || "—"}
                </td>
                <td className="py-2 text-muted-foreground">{a.author?.name ?? "—"}</td>
                <td className="py-2">
                  <Badge variant={statusVariant(a.status)}>{humanize(a.status)}</Badge>
                </td>
                <td className="py-2 text-muted-foreground">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {(articles ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-4 text-center">
                  No articles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <CategoryManager categories={categories ?? []} manufacturers={manufacturers ?? []} modelRanges={modelRanges ?? []} />
    </div>
  );
}
