export const metadata = {
  title: "JARVIS AI Control Center",
  description: "Osobní AI asistent JARVIS, tržní výzkum a systémový panel.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080b10",
};

export default function RootLayout({ children }) {
  return <html lang="cs"><body>{children}</body></html>;
}
