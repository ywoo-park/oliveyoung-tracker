'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AdminPage() {
  const [products, setProducts] = useState([]);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await fetch(`${API_URL}/api/products`).then((r) => r.json());
      setProducts(data);
    } catch {
      setMessage({ type: 'error', text: '상품 목록을 불러오지 못했습니다.' });
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    const oliveyoung_id = input.trim();
    if (!oliveyoung_id) return;

    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oliveyoung_id }),
      });
      const data = await res.json();

      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setMessage({ type: 'success', text: '등록되었습니다. 상세 정보를 백그라운드에서 가져오는 중...' });
        setInput('');
        loadProducts();
      }
    } catch {
      setMessage({ type: 'error', text: '등록에 실패했습니다.' });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`"${name}" 상품을 삭제하시겠습니까?`)) return;
    await fetch(`${API_URL}/api/products/${id}`, { method: 'DELETE' });
    loadProducts();
  }

  async function handleCrawl() {
    setCrawling(true);
    setMessage({ type: 'info', text: '크롤링을 시작했습니다. 완료까지 수 분이 걸릴 수 있습니다.' });
    try {
      await fetch(`${API_URL}/api/crawl`, { method: 'POST' });
      setMessage({ type: 'success', text: '크롤링이 완료되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '크롤링 요청에 실패했습니다.' });
    } finally {
      setCrawling(false);
    }
  }

  const messageStyle = {
    success: 'bg-[#6366F1]/10 text-[#6366F1]',
    error: 'bg-red-50 text-red-600',
    info: 'bg-blue-50 text-blue-700',
  };

  return (
    <main className="pt-24 pb-16 px-4 sm:px-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">어드민</h1>

      {/* 상품 등록 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <h2 className="text-base font-bold text-gray-900 mb-4">상품 등록</h2>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="올리브영 상품 코드 (예: A000000176322)"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/50 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={adding || !input.trim()}
            className="bg-[#6366F1] text-white font-bold px-5 py-3 rounded-xl text-sm hover:bg-[#4F46E5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {adding ? '등록 중...' : '등록'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          URL 예시: oliveyoung.co.kr/...?goodsNo=<strong className="text-gray-600">A000000176322</strong>
        </p>
        {message && (
          <p className={`mt-3 text-sm rounded-xl px-4 py-3 font-medium ${messageStyle[message.type]}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* 수동 크롤링 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">수동 크롤링</h2>
            <p className="text-sm text-gray-400 mt-0.5">매시 10분 자동 실행</p>
          </div>
          <button
            onClick={handleCrawl}
            disabled={crawling}
            className={`px-5 py-3 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
              crawling
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
          >
            {crawling ? '실행 중...' : '지금 크롤링'}
          </button>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">
            등록 상품
            <span className="ml-2 text-sm font-semibold text-gray-400">{products.length}개</span>
          </h2>
        </div>

        {products.length === 0 ? (
          <div className="px-6 py-14 text-center text-gray-400 text-sm">
            등록된 상품이 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {products.map((p) => (
              <li key={p.id} className="px-6 py-4 flex items-center gap-4">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-50"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.oliveyoung_id}</p>
                  {p.sale_price && (
                    <p className="text-xs font-medium text-gray-500 mt-0.5">
                      {p.sale_price.toLocaleString()}원
                      {p.price && p.price !== p.sale_price && (
                        <span className="text-gray-300 line-through ml-1">
                          {p.price.toLocaleString()}원
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="text-xs font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
