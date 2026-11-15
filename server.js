
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

// 게시글 데이터 1000개 생성
const TOPICS = [
  'B-Tree 인덱스 구조와 LIKE %kw% 검색 튜닝 실무',
  '커서 기반(Keyset) 페이지네이션 O(log N) 탐색 원리',
  'ORDER BY SQL Injection과 화이트리스트 매핑 방어',
  'InnoDB 버퍼 풀과 LIMIT OFFSET Cache Thrashing',
  'AbortController를 이용한 비동기 Race Condition 방어',
  '300ms 디바운스(Debounce)와 프론트엔드 입력 최적화',
  'URLSearchParams와 history.pushState 뒤로가기 동기화',
  'InnoDB MVCC 메커니즘과 COUNT(*) 전수 스캔 병목',
  '복합 인덱스(Compound Index) 컬럼 순서의 황금률',
  'Redis 분산 캐시를 활용한 카운트 캐싱 아키텍처',
  'RESTful JSON 페이징 Envelope 규격 표준화',
  'ElasticSearch 역색인(Inverted Index)과 N-gram 전문 검색'
];

const AUTHORS = [
  '이경수', '김철수', '이영희', '박민수',
  '정다은', '최준호', '강서연', '윤성호'
];

const POSTS = Array.from({ length: 1000 }, (_, i) => {
  const id = 1000 - i;
  const topic = TOPICS[i % TOPICS.length];
  const author = AUTHORS[i % AUTHORS.length];
  const views = Math.floor(Math.random() * 5000) + 10;

  return {
    id,
    title: `[#${id}] ${topic}`,
    content: `게시글 ${id}번의 상세 본문 데이터입니다. DB 인덱스와 페이징 최적화를 실습합니다.`,
    author,
    views,
    createdAt: `2026-${(10 - Math.floor(i / 150)).toString().padStart(2, '0')}-${((i % 28) + 1).toString().padStart(2, '0')}`
  };
});

// 정렬 기준
const SORT_WHITELIST = {
  latest: (a, b) =>
    b.createdAt.localeCompare(a.createdAt) || b.id - a.id,

  oldest: (a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id - b.id,

  views: (a, b) =>
    b.views - a.views || b.id - a.id
};

// 오프셋 페이지네이션
app.get('/api/posts', (req, res) => {
  const startTime = process.hrtime();

  const rawPage = parseInt(req.query.page, 10);
  const rawLimit = parseInt(req.query.limit, 10);

  const page = (!isNaN(rawPage) && rawPage > 0) ? rawPage : 1;
  const limit = (!isNaN(rawLimit) && rawLimit > 0)
    ? Math.min(rawLimit, 100) : 10;

  const search = typeof req.query.search === 'string'
    ? req.query.search.trim().toLowerCase() : '';

  const sortKey = req.query.sort;

  // 제목과 본문 검색
  let filtered = POSTS.filter(p => {
    if (!search) return true;

    return p.title.toLowerCase().includes(search) ||
           p.content.toLowerCase().includes(search);
  });

  // 허용된 정렬 기준만 사용
  const sortComparator =
    typeof sortKey === 'string' &&
    Object.hasOwn(SORT_WHITELIST, sortKey)
      ? SORT_WHITELIST[sortKey]
      : SORT_WHITELIST.latest;

  filtered.sort(sortComparator);

  // 페이지 계산
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;

  const items = filtered.slice(offset, offset + limit);

  const diff = process.hrtime(startTime);
  const executionTimeMs =
    (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

  res.setHeader('X-Response-Time', `${executionTimeMs}ms`);

  res.json({
    items,
    meta: {
      page: safePage,
      limit,
      totalCount,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
      executionTimeMs: Number(executionTimeMs)
    }
  });
});

// 커서 페이지네이션 (ID 내림차순)
app.get('/api/posts/cursor', (req, res) => {
  const startTime = process.hrtime();

  const rawCursor = parseInt(req.query.cursor, 10);
  const rawLimit = parseInt(req.query.limit, 10);

  const limit = (!isNaN(rawLimit) && rawLimit > 0)
    ? Math.min(rawLimit, 100) : 10;

  const search = typeof req.query.search === 'string'
    ? req.query.search.trim().toLowerCase() : '';

  // 제목과 본문 검색
  let filtered = POSTS.filter(p => {
    if (!search) return true;

    return p.title.toLowerCase().includes(search) ||
           p.content.toLowerCase().includes(search);
  });

  // ID 내림차순 정렬
  filtered.sort((a, b) => b.id - a.id);

  // 커서보다 작은 ID만 조회
  if (!isNaN(rawCursor) && rawCursor > 0) {
    filtered = filtered.filter(p => p.id < rawCursor);
  }

  // 다음 페이지 존재 여부 확인
  const sliced = filtered.slice(0, limit + 1);
  const hasNext = sliced.length > limit;
  const items = sliced.slice(0, limit);

  const nextCursor = items.length > 0
    ? items[items.length - 1].id
    : null;

  const diff = process.hrtime(startTime);
  const executionTimeMs =
    (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

  res.setHeader('X-Response-Time', `${executionTimeMs}ms`);

  res.json({
    items,
    meta: {
      cursor: !isNaN(rawCursor) && rawCursor > 0
        ? rawCursor : null,
      nextCursor,
      limit,
      hasNext,
      executionTimeMs: Number(executionTimeMs)
    }
  });
});

app.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`);
  console.log(`게시글 ${POSTS.length}개 로드 완료`);
});
