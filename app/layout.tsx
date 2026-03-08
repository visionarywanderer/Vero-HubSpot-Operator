import type { Metadata } from "next";
import "./globals.css";
import { AppFrame } from "@/components/layout/AppFrame";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Vero HubSpot Operator",
  description: "Unified control panel for HubSpot portal operations"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
