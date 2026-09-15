import { AssetWarrantyReport, type WarrantySearchParams } from "@/components/asset-register/warranty-report";

export default async function WarrantyReportPage({ searchParams }: { searchParams: Promise<WarrantySearchParams> }) {
  return <AssetWarrantyReport searchParams={searchParams} basePath="/office/asset-register" />;
}
