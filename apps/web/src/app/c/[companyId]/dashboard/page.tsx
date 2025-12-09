import Script from "next/script";
import DashboardPage from "@/app/dashboard/page";

export default function CompanyDashboardPage({ params }: { params: { companyId: string } }) {
  const companyId = params.companyId;

  return (
    <>
      <Script id="company-sync" strategy="beforeInteractive">
        {`try{localStorage.setItem('selectedCompanyId','${companyId}');document.cookie='selected_company_id=${companyId};path=/;max-age=31536000;SameSite=Lax'}catch{}`}
      </Script>
      <DashboardPage />
    </>
  );
}
