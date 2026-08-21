import type { Metadata, Viewport } from "next";
import { Geist_Mono, Montserrat } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { getCurrentUser } from "@/lib/auth/current-user";
import { themeClassName } from "@/lib/theme/themes";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UXG Engineer Job Scheduler",
  description: "Field service job management — install forms, photos, signatures, offline.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UXG",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c2448",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Signed-out visitors (the login page, a public share link) get no user
  // and so no theme class — themeClassName("") falls through to "", the
  // same default-light result as an explicit "light" preference.
  const user = await getCurrentUser();
  const themeClass = themeClassName(user?.theme ?? "");

  return (
    <html
      lang="en"
      className={[montserrat.variable, geistMono.variable, "h-full antialiased", themeClass].filter(Boolean).join(" ")}
    >
      <body className="min-h-full flex flex-col">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
