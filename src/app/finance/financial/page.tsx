import { AssetFinancialReport, type FinancialSearchParams } from "@/components/asset-register/financial-report";

export default async function FinanceFinancialReportPage({ searchParams }: { searchParams: Promise<FinancialSearchParams> }) {
  return <AssetFinancialReport searchParams={searchParams} basePath="/finance" />;
}
