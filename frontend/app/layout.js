import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'BM Insight Tracker',
  description: '올리브영 리뷰·랭킹 인사이트 트래커',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-mood-ice text-mood-feather antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
