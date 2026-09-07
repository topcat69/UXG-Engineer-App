"use client";

type Category = { id: string; name: string };
type Manufacturer = { id: string; name: string; category_id: string };
type ModelRange = { id: string; name: string; manufacturer_id: string };

/**
 * The Category -> Manufacturer -> Model range cascading picker used
 * everywhere an article's placement is chosen or filtered by — office's
 * write/edit forms, the field app's submit/resubmit forms, and the field
 * app's browse filter (see how each of those call sites hooks up
 * onCategoryChange/onManufacturerChange to also clear the level(s)
 * beneath, so the selects never end up showing options that don't
 * actually belong to the level above). Category is the only required
 * level in an authoring form — Manufacturer and Model range both start
 * with a "—" option so an article can be filed at whichever level of
 * specificity actually fits it (decision confirmed alongside the fixed
 * 3-level shape itself).
 */
export function CategoryPicker({
  categories,
  manufacturers,
  modelRanges,
  categoryId,
  manufacturerId,
  modelRangeId,
  onCategoryChange,
  onManufacturerChange,
  onModelRangeChange,
  categoryRequired = true,
}: {
  categories: Category[];
  manufacturers: Manufacturer[];
  modelRanges: ModelRange[];
  categoryId: string;
  manufacturerId: string;
  modelRangeId: string;
  onCategoryChange: (categoryId: string) => void;
  onManufacturerChange: (manufacturerId: string) => void;
  onModelRangeChange: (modelRangeId: string) => void;
  /** false for a filter (an unset category means "all"), true for an authoring form (category is mandatory to file an article at all). */
  categoryRequired?: boolean;
}) {
  const manufacturerOptions = manufacturers.filter((m) => m.category_id === categoryId);
  const modelRangeOptions = modelRanges.filter((r) => r.manufacturer_id === manufacturerId);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Category</label>
        <select
          value={categoryId}
          onChange={(e) => {
            onCategoryChange(e.target.value);
            onManufacturerChange("");
            onModelRangeChange("");
          }}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">{categoryRequired ? "Select…" : "All"}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Manufacturer</label>
        <select
          value={manufacturerId}
          onChange={(e) => {
            onManufacturerChange(e.target.value);
            onModelRangeChange("");
          }}
          disabled={!categoryId}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">{categoryId ? "—" : "Pick a category first"}</option>
          {manufacturerOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Model range</label>
        <select
          value={modelRangeId}
          onChange={(e) => onModelRangeChange(e.target.value)}
          disabled={!manufacturerId}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">{manufacturerId ? "—" : "Pick a manufacturer first"}</option>
          {modelRangeOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
