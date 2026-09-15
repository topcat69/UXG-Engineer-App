import { AssetWarrantyReport, type WarrantySearchParams } from "@/components/asset-register/warranty-report";

export default async function FinanceWarrantyReportPage({ searchParams }: { searchParams: Promise<WarrantySearchParams> }) {
  return <AssetWarrantyReport searchParams={searchParams} basePath="/finance" />;
}
