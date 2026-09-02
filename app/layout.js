import './globals.css';
import SiteHeader from './components/SiteHeader';

export const metadata = {
  title: 'NightOutStays',
  description: 'Book short stays directly with NightOutStays',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}