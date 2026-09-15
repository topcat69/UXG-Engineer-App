import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { DamagedEquipmentManager } from "./damaged-equipment-manager";

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function DamagedEquipmentPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: items, error }, { data: clients }, { data: sites }, { data: manufacturers }, { data: models }] = await Promise.all([
    supabase
      .from("damaged_equipment")
      .select(
        `id, manufacturer, model, description, serial_number, site_id, damage_notes, next_step, photo_path,
         created_at, site:sites(name, client:clients(name))`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sites").select("id, name, client_id").order("name"),
    supabase.from("stock_manufacturers").select("id, name").order("name"),
    supabase.from("stock_models").select("id, name, manufacturer_id, description").order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load Damaged Equipment: {error.message}</p>;
  }

  const itemsWithUrls = await Promise.all(
    (items ?? []).map(async (item) => {
      if (!item.photo_path) return { ...item, photoUrl: null };
      const { data } = await supabase.storage.from("damaged-equipment-photos").createSignedUrl(item.photo_path, PHOTO_SIGNED_URL_TTL_SECONDS);
      return { ...item, photoUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Damaged Equipment</h1>
        <p className="text-muted-foreground text-sm">
          Every stock item scanned in as damaged — or edited to damaged afterward — lands here automatically, with a
          Damaged Stock Alert emailed out. Log something manually below if it was never scanned in at all (e.g.
          damaged on the shelf).
        </p>
      </div>
      <DamagedEquipmentManager
        initialItems={itemsWithUrls}
        clients={clients ?? []}
        sites={sites ?? []}
        manufacturers={manufacturers ?? []}
        models={models ?? []}
        canDelete={user?.role === "superadmin" || user?.role === "manager"}
      />
    </div>
  );
}
