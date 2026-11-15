import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DashboardFiltersProvider } from "@/components/dashboard/DashboardFiltersProvider";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FIRE MEMORY | Satellite Activity Dashboard",
  description:
    "Explore historical satellite detections across the Philippines.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DashboardFiltersProvider
          isSimulated={process.env.NEXT_PUBLIC_USE_MOCKS === "true"}
        >
          {children}
        </DashboardFiltersProvider>
      </body>
    </html>
  );
}
