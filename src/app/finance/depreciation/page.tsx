import { AssetDepreciationReport, type DepreciationSearchParams } from "@/components/asset-register/depreciation-report";

export default async function FinanceDepreciationReportPage({
  searchParams,
}: {
  searchParams: Promise<DepreciationSearchParams>;
}) {
  return <AssetDepreciationReport searchParams={searchParams} basePath="/finance" />;
}
