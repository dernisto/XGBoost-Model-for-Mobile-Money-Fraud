import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Silo Monitoring System",
  description: "Live Smart Silo dashboard powered by ESP32 and Blynk IoT",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
