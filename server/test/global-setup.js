const { execSync } = require('child_process');
const path = require('path');

// 每次跑测试前重建测试库结构
module.exports = async () => {
  const serverDir = path.resolve(__dirname, '..');
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: serverDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
};
