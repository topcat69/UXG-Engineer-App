"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlatListSection, type NamedListRow } from "@/components/office/flat-list-section";
import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";
import {
  createAssetCategory,
  createAssetManually,
  deleteAssetCategory,
  deleteAssetRegisterRow,
  searchSites,
  updateAssetCategory,
  updateAssetRegister,
  type AssetFieldsInput,
  type AssetRegisterRow,
  type SiteSearchResult,
} from "@/app/office/asset-register/actions";
import { SITE_SEARCH_LIMIT } from "@/lib/forms/site-search";

type AssetStatus = Database["public"]["Enums"]["asset_status"];
const ASSET_STATUSES: AssetStatus[] = ["spare", "in_use", "faulty", "in_repair", "retired"];

type AssetWithJoins = AssetRegisterRow & {
  category: { name: string } | null;
  site: { name: string; client: { name: string } | null } | null;
};

type SiteOption = { id: string; name: string; client: { name: string } | null };

const EMPTY_FIELDS: AssetFieldsInput = {
  categoryId: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  fixture: "",
  siteId: "",
  purchaseDate: "",
  supplier: "",
  poOrInvoiceNumber: "",
  purchaseCost: "",
  depreciationMethod: "",
  usefulLifeYears: "",
  residualValue: "",
  warrantyStart: "",
  warrantyEnd: "",
  warrantyProvider: "",
  supportContractRef: "",
  supportSla: "",
  status: "spare",
  expectedReplacementDate: "",
  decommissionDate: "",
  disposalDate: "",
  weeeReference: "",
  needsReview: false,
};

function assetToFields(asset: AssetRegisterRow): AssetFieldsInput {
  return {
    categoryId: asset.category_id ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serial_number ?? "",
    fixture: asset.fixture ?? "",
    siteId: asset.site_id ?? "",
    purchaseDate: asset.purchase_date ?? "",
    supplier: asset.supplier ?? "",
    poOrInvoiceNumber: asset.po_or_invoice_number ?? "",
    purchaseCost: asset.purchase_cost != null ? String(asset.purchase_cost) : "",
    depreciationMethod: asset.depreciation_method ?? "",
    usefulLifeYears: asset.useful_life_years != null ? String(asset.useful_life_years) : "",
    residualValue: asset.residual_value != null ? String(asset.residual_value) : "",
    warrantyStart: asset.warranty_start ?? "",
    warrantyEnd: asset.warranty_end ?? "",
    warrantyProvider: asset.warranty_provider ?? "",
    supportContractRef: asset.support_contract_ref ?? "",
    supportSla: asset.support_sla ?? "",
    status: asset.status,
    expectedReplacementDate: asset.expected_replacement_date ?? "",
    decommissionDate: asset.decommission_date ?? "",
    disposalDate: asset.disposal_date ?? "",
    weeeReference: asset.weee_reference ?? "",
    needsReview: asset.needs_review,
  };
}

function assetItemLabel(asset: AssetWithJoins): string {
  return [asset.manufacturer, asset.model].filter(Boolean).join(" ") || "—";
}

/**
 * Shared between /office/asset-register (superadmin/manager, full access)
 * and /finance (the Finance role's own stripped-down surface — see
 * requireFinanceUser). canManageCategories/canDelete default true for the
 * office page; /finance passes both false, matching the RLS grants in
 * 20260914040000_finance_asset_register_access.sql (Finance can view,
 * add, and edit — not delete rows or curate the category picklist).
 * Bulk CSV import lives at /office/import instead of here — see that
 * page's own comment on why.
 */
export function AssetRegisterManager({
  initialAssets,
  categories: initialCategories,
  sites,
  clients,
  canManageCategories = true,
  canDelete = true,
}: {
  initialAssets: AssetWithJoins[];
  categories: NamedListRow[];
  sites: SiteOption[];
  clients: { id: string; name: string }[];
  canManageCategories?: boolean;
  canDelete?: boolean;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [categories, setCategories] = useState(initialCategories);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<AssetFieldsInput>(EMPTY_FIELDS);
  // The site search box's starting display text — sourced from this
  // specific asset's own joined site (unaffected by the 1000-row cap on
  // the `sites` prop below), not a lookup into that prop, so an asset
  // already assigned to a site outside the first 1000 still shows its
  // real site name rather than blanking it out.
  const [editSiteLabel, setEditSiteLabel] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [addFields, setAddFields] = useState<AssetFieldsInput>(EMPTY_FIELDS);

  const needsReviewCount = useMemo(() => assets.filter((a) => a.needs_review).length, [assets]);

  // Looked up from the current categories/sites props rather than trusting
  // each row's server-joined category/site sub-object — that join only
  // reflects the page's initial load, so it goes stale the moment an edit
  // changes category_id/site_id without a full page reload.
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const siteNameById = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const clientNameById = useMemo(() => new Map(sites.map((s) => [s.id, s.client?.name ?? null])), [sites]);

  // A search box instead of scrolling through however many hundred assets
  // are on file — matches across everything already visible in the table
  // (item, serial, category, client, site), not just the item name.
  const visibleAssets = useMemo(() => {
    let list = needsReviewOnly ? assets.filter((a) => a.needs_review) : assets;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const categoryName = (a.category_id && categoryNameById.get(a.category_id)) || "";
        const clientName = (a.site_id && clientNameById.get(a.site_id)) || "";
        const siteName = (a.site_id && siteNameById.get(a.site_id)) || "";
        const haystack = [a.manufacturer, a.model, a.serial_number, a.fixture, categoryName, clientName, siteName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [assets, needsReviewOnly, search, categoryNameById, clientNameById, siteNameById]);

  function handleStartEdit(asset: AssetWithJoins) {
    setEditingId(asset.id);
    setEditFields(assetToFields(asset));
    setEditSiteLabel(asset.site ? (asset.site.client ? `${asset.site.name} — ${asset.site.client.name}` : asset.site.name) : "");
    setMessage(null);
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const id = editingId;
    startTransition(async () => {
      const result = await updateAssetRegister(id, editFields);
      if (result.ok) {
        setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...result.item } : a)));
        setEditingId(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this asset register entry? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteAssetRegisterRow(id);
      if (result.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== id));
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await createAssetManually(addFields);
      if (result.ok) {
        setAssets((prev) => [{ ...result.item, category: null, site: null }, ...prev]);
        setAddFields(EMPTY_FIELDS);
        setShowAddForm(false);
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  const categoryOptions = categories;

  function renderFieldsForm(fields: AssetFieldsInput, setFields: (f: AssetFieldsInput) => void, siteLabel: string) {
    return (
      <div className="flex flex-col gap-4">
        <FieldGroup title="Identification & device detail">
          <LabeledSelect
            label="Category"
            value={fields.categoryId}
            onChange={(v) => setFields({ ...fields, categoryId: v })}
            options={[{ id: "", name: "—" }, ...categoryOptions]}
          />
          <LabeledInput label="Manufacturer" value={fields.manufacturer} onChange={(v) => setFields({ ...fields, manufacturer: v })} />
          <LabeledInput label="Model" value={fields.model} onChange={(v) => setFields({ ...fields, model: v })} />
          <LabeledInput label="Serial number" value={fields.serialNumber} onChange={(v) => setFields({ ...fields, serialNumber: v })} />
          <LabeledInput
            label="Fixture"
            value={fields.fixture}
            onChange={(v) => setFields({ ...fields, fixture: v })}
            placeholder="e.g. Reception screen, Till 3"
          />
        </FieldGroup>

        <FieldGroup title="Location">
          <SiteSearchSelect
            value={fields.siteId}
            defaultLabel={siteLabel}
            placeholder={fields.status === "spare" ? "Unassigned — search to assign a site" : "Search by name, store ID, address, town, or postcode…"}
            onChange={(v) => setFields({ ...fields, siteId: v })}
            clients={clients}
          />
        </FieldGroup>

        <FieldGroup title="Procurement / financial">
          <LabeledInput label="Purchase date" type="date" value={fields.purchaseDate} onChange={(v) => setFields({ ...fields, purchaseDate: v })} />
          <LabeledInput label="Supplier" value={fields.supplier} onChange={(v) => setFields({ ...fields, supplier: v })} />
          <LabeledInput
            label="PO / invoice no."
            value={fields.poOrInvoiceNumber}
            onChange={(v) => setFields({ ...fields, poOrInvoiceNumber: v })}
          />
          <LabeledInput
            label="Purchase cost (GBP)"
            type="number"
            value={fields.purchaseCost}
            onChange={(v) => setFields({ ...fields, purchaseCost: v })}
          />
          <LabeledInput
            label="Depreciation method"
            value={fields.depreciationMethod}
            onChange={(v) => setFields({ ...fields, depreciationMethod: v })}
            placeholder="e.g. Straight-line"
          />
          <LabeledInput
            label="Useful life (years)"
            type="number"
            value={fields.usefulLifeYears}
            onChange={(v) => setFields({ ...fields, usefulLifeYears: v })}
          />
          <LabeledInput
            label="Residual value (GBP)"
            type="number"
            value={fields.residualValue}
            onChange={(v) => setFields({ ...fields, residualValue: v })}
          />
        </FieldGroup>

        <FieldGroup title="Warranty & support">
          <LabeledInput label="Warranty start" type="date" value={fields.warrantyStart} onChange={(v) => setFields({ ...fields, warrantyStart: v })} />
          <LabeledInput label="Warranty end" type="date" value={fields.warrantyEnd} onChange={(v) => setFields({ ...fields, warrantyEnd: v })} />
          <LabeledInput
            label="Warranty provider"
            value={fields.warrantyProvider}
            onChange={(v) => setFields({ ...fields, warrantyProvider: v })}
          />
          <LabeledInput
            label="Support contract ref"
            value={fields.supportContractRef}
            onChange={(v) => setFields({ ...fields, supportContractRef: v })}
          />
          <LabeledInput label="Support SLA" value={fields.supportSla} onChange={(v) => setFields({ ...fields, supportSla: v })} />
        </FieldGroup>

        <FieldGroup title="Lifecycle & status">
          <LabeledSelect
            label="Status"
            value={fields.status}
            onChange={(v) => setFields({ ...fields, status: v as AssetStatus })}
            options={ASSET_STATUSES.map((s) => ({ id: s, name: humanize(s) }))}
          />
          <LabeledInput
            label="Expected replacement date"
            type="date"
            value={fields.expectedReplacementDate}
            onChange={(v) => setFields({ ...fields, expectedReplacementDate: v })}
          />
          <LabeledInput
            label="Decommission date"
            type="date"
            value={fields.decommissionDate}
            onChange={(v) => setFields({ ...fields, decommissionDate: v })}
          />
          <LabeledInput label="Disposal date" type="date" value={fields.disposalDate} onChange={(v) => setFields({ ...fields, disposalDate: v })} />
          <LabeledInput label="WEEE reference" value={fields.weeeReference} onChange={(v) => setFields({ ...fields, weeeReference: v })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fields.needsReview} onChange={(e) => setFields({ ...fields, needsReview: e.target.checked })} />
            Needs review
          </label>
        </FieldGroup>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {canManageCategories && (
        <FlatListSection
          title="Asset Categories"
          helperText="Display, media player, mount, bracket, PSU, cabling, etc. — picked when filling in an asset's details."
          items={categories}
          create={createAssetCategory}
          update={updateAssetCategory}
          remove={deleteAssetCategory}
          onCreated={(item) => setCategories((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))}
          onUpdated={(item) => setCategories((prev) => prev.map((c) => (c.id === item.id ? item : c)).sort((a, b) => a.name.localeCompare(b.name)))}
          onDeleted={(id) => setCategories((prev) => prev.filter((c) => c.id !== id))}
          confirmDeleteText="Delete this category? Assets using it fall back to uncategorised — this can't be undone."
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, serial, client, site…"
            className="border-input h-9 w-64 rounded-md border bg-transparent px-3 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} />
            Needs review only
            <Badge variant={needsReviewCount > 0 ? "destructive" : "secondary"}>{needsReviewCount}</Badge>
          </label>
        </div>
        <Button type="button" size="sm" onClick={() => setShowAddForm((prev) => !prev)}>
          {showAddForm ? "Cancel" : "Add asset manually"}
        </Button>
      </div>

      {showAddForm && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="font-medium">Add asset manually</h2>
          <p className="text-muted-foreground text-xs">
            For an asset that&apos;s part of the estate but never went through goods-in — everything scanned in already gets
            its own row automatically.
          </p>
          {renderFieldsForm(addFields, setAddFields, "")}
          <div className="flex gap-2">
            <Button type="button" disabled={isPending} onClick={handleAdd}>
              Add asset
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {editingId && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="font-medium">Edit asset</h2>
          {renderFieldsForm(editFields, setEditFields, editSiteLabel)}
          <div className="flex gap-2">
            <Button type="button" disabled={isPending} onClick={handleSaveEdit}>
              Save
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {message && <p className="text-destructive text-sm">{message}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Category</th>
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Serial no.</th>
            <th className="py-2 font-medium">Client</th>
            <th className="py-2 font-medium">Site</th>
            <th className="py-2 font-medium">Fixture</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Install date</th>
            <th className="py-2 font-medium">Review</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleAssets.length === 0 && (
            <tr>
              <td colSpan={10} className="text-muted-foreground py-6 text-center">
                {search.trim()
                  ? "No assets match this search."
                  : needsReviewOnly
                    ? "Nothing needs review."
                    : "Nothing in the register yet."}
              </td>
            </tr>
          )}
          {visibleAssets.map((asset) => (
            <tr key={asset.id} className="border-b">
              <td className="py-2">
                {(asset.category_id && categoryNameById.get(asset.category_id)) ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2">{assetItemLabel(asset)}</td>
              <td className="py-2 text-muted-foreground">{asset.serial_number ?? "—"}</td>
              <td className="py-2 text-muted-foreground">{(asset.site_id && clientNameById.get(asset.site_id)) || "—"}</td>
              <td className="py-2 text-muted-foreground">{(asset.site_id && siteNameById.get(asset.site_id)) ?? "Unassigned"}</td>
              <td className="py-2 text-muted-foreground">{asset.fixture ?? "—"}</td>
              <td className="py-2">
                <Badge variant="secondary">{humanize(asset.status)}</Badge>
              </td>
              <td className="py-2 text-muted-foreground">{asset.install_date ?? "—"}</td>
              <td className="py-2">
                {asset.needs_review ? <Badge variant="destructive">Needs review</Badge> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleStartEdit(asset)}>
                    Edit
                  </Button>
                  {canDelete && (
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDelete(asset.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</h3>
      <div className="flex flex-wrap items-end gap-2">{children}</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-xs">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border-input h-9 w-44 rounded-md border bg-transparent px-2 text-sm"
      />
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-xs">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input h-9 w-44 rounded-md border bg-transparent px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Searches server-side (searchSites, same ilike fields as office/sites'
 * own search box) instead of picking from a flat list loaded up front —
 * that list hit PostgREST's default 1000-row cap with 1195 sites on
 * file, so a plain <select> here could never reach ~195 of them no
 * matter how far you scrolled. defaultLabel seeds the visible text from
 * the asset's own already-joined site (see handleStartEdit) so opening
 * an edit shows the real current site even if it's one of those ~195 —
 * it's then just local display text, uncontrolled past mount.
 */
function SiteSearchSelect({
  value,
  defaultLabel,
  placeholder,
  onChange,
  clients,
}: {
  value: string;
  defaultLabel: string;
  placeholder?: string;
  onChange: (siteId: string) => void;
  /** Narrows the search, same as office/sites' own Customer filter — several
   * customers often have similarly-named sites (e.g. multiple "Aberdeen"
   * stores across different retailers), so picking the customer first
   * narrows the list before typing a single character. */
  clients: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState(defaultLabel);
  const [clientId, setClientId] = useState("");
  const [results, setResults] = useState<SiteSearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(q: string, forClientId: string) {
    setIsSearching(true);
    searchSites(q, forClientId || undefined).then((rows) => {
      setTruncated(rows.length > SITE_SEARCH_LIMIT);
      setResults(rows.slice(0, SITE_SEARCH_LIMIT));
      setIsSearching(false);
    });
  }

  function handleInputChange(v: string) {
    setQuery(v);
    setIsOpen(true);
    if (value) onChange(""); // typing again means the previous pick no longer applies
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v, clientId), 300);
  }

  function handleClientChange(v: string) {
    setClientId(v);
    setIsOpen(true);
    runSearch(query, v);
  }

  function handleFocus() {
    setIsOpen(true);
    if (results.length === 0) runSearch(query, clientId);
  }

  function handleSelect(site: SiteSearchResult) {
    setQuery(site.client ? `${site.name} — ${site.client.name}` : site.name);
    onChange(site.id);
    setIsOpen(false);
  }

  function handleClear() {
    setQuery("");
    onChange("");
    setResults([]);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Customer</label>
        <select
          value={clientId}
          onChange={(e) => handleClientChange(e.target.value)}
          className="border-input h-9 w-40 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">All</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="relative flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Site</label>
        <div className="flex items-center gap-1">
          <input
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            placeholder={placeholder}
            className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
          />
          {value && (
            <button type="button" onClick={handleClear} className="text-muted-foreground text-xs underline">
              Clear
            </button>
          )}
        </div>
        {isOpen && (
          <div className="bg-popover absolute top-full z-10 mt-1 max-h-64 w-64 overflow-y-auto rounded-md border shadow-md">
            {isSearching ? (
              <p className="text-muted-foreground p-2 text-xs">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-muted-foreground p-2 text-xs">No matching sites.</p>
            ) : (
              <>
                {results.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(site)}
                    className="hover:bg-accent block w-full px-2 py-1.5 text-left text-sm"
                  >
                    {site.client ? `${site.name} — ${site.client.name}` : site.name}
                  </button>
                ))}
                {truncated && (
                  <p className="text-muted-foreground border-t p-2 text-xs">
                    Showing the first {SITE_SEARCH_LIMIT} matches — keep typing to narrow further.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
