export const metadata = {
  title: "Rork AI Backend",
  description: "Backend API for Rork app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
