import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatBotPro — AI CSV Data Analyst",
  description:
    "Drop any CSV, ask questions in plain English. StatBotPro's LangChain agent writes pandas code, executes it safely in a sandbox, and returns answers with charts.",
  keywords: ["CSV analysis", "AI", "data analytics", "LangChain", "GPT-4", "pandas", "charts"],
  authors: [{ name: "StatBotPro" }],
  openGraph: {
    title: "StatBotPro — AI CSV Data Analyst",
    description: "Autonomous AI agent for CSV data analysis. Ask anything, get charts + code.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060910",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh flex flex-col antialiased">{children}</body>
    </html>
  );
}
