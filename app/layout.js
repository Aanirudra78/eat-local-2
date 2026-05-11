import { Rye, Lato } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/context/AuthContext';

const rye = Rye({
  variable: "--font-rustico",
  weight: "400",
  subsets: ["latin"],
});

const lato = Lato({
  variable: "--font-sans",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata = {
  title: "YUMMYY",
  description: "Food delivery management system",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${rye.variable} ${lato.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}