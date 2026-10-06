// 测试使用独立的 SQLite 库，不污染 dev.db
process.env.DATABASE_URL = 'file:./test.db';
