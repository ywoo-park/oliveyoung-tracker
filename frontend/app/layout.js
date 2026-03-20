import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: '올리브영 랭킹 트래커',
  description: '올리브영 상품 순위를 트래킹합니다.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="bg-[#F0F0F0] min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}
