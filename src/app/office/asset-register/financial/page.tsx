import { AssetFinancialReport, type FinancialSearchParams } from "@/components/asset-register/financial-report";

export default async function FinancialReportPage({ searchParams }: { searchParams: Promise<FinancialSearchParams> }) {
  return <AssetFinancialReport searchParams={searchParams} basePath="/office/asset-register" />;
}
