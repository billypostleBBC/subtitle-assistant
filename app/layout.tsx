import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Subtitle proofing and conversion",
  description: "Proof an approved timestamped transcript and export WebVTT.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
