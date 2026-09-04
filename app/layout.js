import './globals.css';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';

export const metadata = {
  title: 'NightOutStays',
  description: 'Book short stays directly with NightOutStays',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}