import { EventListener } from '../lib/event-listener';
import fs from 'fs';
import path from 'path';

// 配置
const CONFIG = {
  RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  PROGRAM_ID: process.env.PROGRAM_ID || 'YourProgramIdHere',
  MYSQL_URL: process.env.DATABASE_URL || 'mysql://user:password@localhost:3306/predix',
  ENABLED: process.env.EVENT_LISTENER_ENABLED === 'true',
  IDL_PATH: process.env.IDL_PATH || ''
};

async function main() {
  console.log('🚀 Starting Event Listener Service...');
  console.log('Configuration:');
  console.log(`- RPC URL: ${CONFIG.RPC_URL}`);
  console.log(`- Program ID: ${CONFIG.PROGRAM_ID}`);
  console.log(`- IDL Path: ${CONFIG.IDL_PATH || '(not configured)'}`);
  console.log(`- Enabled: ${CONFIG.ENABLED}`);

  try {
    if (!CONFIG.ENABLED) {
      console.log('⚠️ Event listener is disabled by configuration. Exit.');
      process.exit(0);
    }

    if (!CONFIG.IDL_PATH) {
      throw new Error('IDL path not configured');
    }

    // 读取IDL文件
    const idlPath = path.resolve(__dirname, CONFIG.IDL_PATH);
    if (!fs.existsSync(idlPath)) {
      throw new Error(`IDL file not found: ${idlPath}`);
    }

    const idlContent = fs.readFileSync(idlPath, 'utf8');
    const idl = JSON.parse(idlContent);

    // 创建事件监听器
    const eventListener = new EventListener(
      CONFIG.RPC_URL,
      CONFIG.PROGRAM_ID,
      CONFIG.MYSQL_URL
    );

    // 初始化
    await eventListener.initialize(idl);

    // 启动监听
    await eventListener.start();

    console.log('✅ Event Listener Service started successfully');
    console.log('Press Ctrl+C to stop...');

    // 优雅关闭处理
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Event Listener Service...');
      await eventListener.stop();
      console.log('✅ Event Listener Service stopped');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Event Listener Service...');
      await eventListener.stop();
      console.log('✅ Event Listener Service stopped');
      process.exit(0);
    });

    // 定期输出状态
    setInterval(() => {
      const status = eventListener.getStatus();
      console.log(`[${new Date().toISOString()}] Status: ${status.isRunning ? 'Running' : 'Stopped'}`);
    }, 60000); // 每分钟输出一次状态

  } catch (error) {
    console.error('❌ Failed to start Event Listener Service:', error);
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// 启动服务
main().catch(console.error);