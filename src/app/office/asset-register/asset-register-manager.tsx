"use client";

import { useMemo, useState, useTransition } from "react";
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
  updateAssetCategory,
  updateAssetRegister,
  type AssetFieldsInput,
  type AssetRegisterRow,
} from "./actions";

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

function assetLabel(asset: AssetWithJoins): string {
  const parts = [asset.manufacturer, asset.model].filter(Boolean).join(" ");
  const withSerial = asset.serial_number ? `${parts || "—"} — ${asset.serial_number}` : parts || "—";
  return withSerial;
}

export function AssetRegisterManager({
  initialAssets,
  categories: initialCategories,
  sites,
}: {
  initialAssets: AssetWithJoins[];
  categories: NamedListRow[];
  sites: SiteOption[];
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [categories, setCategories] = useState(initialCategories);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<AssetFieldsInput>(EMPTY_FIELDS);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addFields, setAddFields] = useState<AssetFieldsInput>(EMPTY_FIELDS);

  const needsReviewCount = useMemo(() => assets.filter((a) => a.needs_review).length, [assets]);
  const visibleAssets = needsReviewOnly ? assets.filter((a) => a.needs_review) : assets;

  // Looked up from the current categories/sites props rather than trusting
  // each row's server-joined category/site sub-object — that join only
  // reflects the page's initial load, so it goes stale the moment an edit
  // changes category_id/site_id without a full page reload.
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const siteLabelById = useMemo(
    () => new Map(sites.map((s) => [s.id, s.client ? `${s.name} — ${s.client.name}` : s.name])),
    [sites],
  );

  function handleStartEdit(asset: AssetRegisterRow) {
    setEditingId(asset.id);
    setEditFields(assetToFields(asset));
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
  const siteOptions = sites;

  function renderFieldsForm(fields: AssetFieldsInput, setFields: (f: AssetFieldsInput) => void) {
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
        </FieldGroup>

        <FieldGroup title="Location">
          <LabeledSelect
            label="Site"
            value={fields.siteId}
            onChange={(v) => setFields({ ...fields, siteId: v })}
            options={[
              { id: "", name: fields.status === "spare" ? "Unassigned" : "Select…" },
              ...siteOptions.map((s) => ({ id: s.id, name: s.client ? `${s.name} — ${s.client.name}` : s.name })),
            ]}
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

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} />
          Needs review only
          <Badge variant={needsReviewCount > 0 ? "destructive" : "secondary"}>{needsReviewCount}</Badge>
        </label>
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
          {renderFieldsForm(addFields, setAddFields)}
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
          {renderFieldsForm(editFields, setEditFields)}
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
            <th className="py-2 font-medium">Site</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Install date</th>
            <th className="py-2 font-medium">Review</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleAssets.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted-foreground py-6 text-center">
                {needsReviewOnly ? "Nothing needs review." : "Nothing in the register yet."}
              </td>
            </tr>
          )}
          {visibleAssets.map((asset) => (
            <tr key={asset.id} className="border-b">
              <td className="py-2">
                {(asset.category_id && categoryNameById.get(asset.category_id)) ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2">{assetLabel(asset)}</td>
              <td className="py-2 text-muted-foreground">
                {(asset.site_id && siteLabelById.get(asset.site_id)) ?? "Unassigned"}
              </td>
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
                  <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDelete(asset.id)}>
                    Delete
                  </Button>
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
