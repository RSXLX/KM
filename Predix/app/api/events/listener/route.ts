import { NextRequest, NextResponse } from 'next/server';
import { EventListener } from '../../../../lib/event-listener';
import fs from 'fs';
import path from 'path';

// 全局事件监听器实例
let globalEventListener: EventListener | null = null;

// 配置
const CONFIG = {
  RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  PROGRAM_ID: process.env.PROGRAM_ID || 'YourProgramIdHere',
  MYSQL_URL: process.env.DATABASE_URL || 'mysql://user:password@localhost:3306/predix',
  ENABLED: process.env.EVENT_LISTENER_ENABLED === 'true',
  IDL_PATH: process.env.IDL_PATH || ''
};

// GET - 获取监听器状态
export async function GET() {
  try {
    if (!globalEventListener) {
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          status: CONFIG.ENABLED ? 'Not initialized' : 'Disabled',
          programId: CONFIG.PROGRAM_ID,
          rpcUrl: CONFIG.RPC_URL
        }
      });
    }

    const status = globalEventListener.getStatus();
    return NextResponse.json({
      success: true,
      data: {
        ...status,
        config: {
          programId: CONFIG.PROGRAM_ID,
          rpcUrl: CONFIG.RPC_URL,
        }
      }
    });

  } catch (error) {
    console.error('Error getting listener status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get listener status'
    }, { status: 500 });
  }
}

// POST - 启动或停止监听器
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (!CONFIG.ENABLED) {
      return NextResponse.json({
        success: false,
        error: 'Event listener is disabled by configuration'
      }, { status: 400 });
    }

    switch (action) {
      case 'start':
        return await startListener();
      case 'stop':
        return await stopListener();
      case 'restart':
        await stopListener();
        return await startListener();
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use "start", "stop", or "restart"'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error handling listener action:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to handle listener action'
    }, { status: 500 });
  }
}

async function startListener() {
  try {
    if (globalEventListener?.getStatus().isRunning) {
      return NextResponse.json({
        success: false,
        error: 'Event listener is already running'
      }, { status: 400 });
    }

    if (!CONFIG.IDL_PATH) {
      return NextResponse.json({
        success: false,
        error: 'IDL path not configured'
      }, { status: 400 });
    }

    // 读取IDL文件
    const idlPath = path.resolve(process.cwd(), CONFIG.IDL_PATH);
    if (!fs.existsSync(idlPath)) {
      return NextResponse.json({
        success: false,
        error: `IDL file not found: ${idlPath}`
      }, { status: 400 });
    }

    const idlContent = fs.readFileSync(idlPath, 'utf8');
    const idl = JSON.parse(idlContent);

    // 创建新的事件监听器
    globalEventListener = new EventListener(
      CONFIG.RPC_URL,
      CONFIG.PROGRAM_ID,
      CONFIG.MYSQL_URL
    );

    // 初始化并启动
    await globalEventListener.initialize(idl);
    await globalEventListener.start();

    return NextResponse.json({
      success: true,
      message: 'Event listener started successfully',
      data: globalEventListener.getStatus()
    });

  } catch (error) {
    console.error('Error starting listener:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to start event listener: ${error.message}`
    }, { status: 500 });
  }
}

async function stopListener() {
  try {
    if (!globalEventListener) {
      return NextResponse.json({
        success: false,
        error: 'Event listener is not initialized'
      }, { status: 400 });
    }

    if (!globalEventListener.getStatus().isRunning) {
      return NextResponse.json({
        success: false,
        error: 'Event listener is not running'
      }, { status: 400 });
    }

    await globalEventListener.stop();

    return NextResponse.json({
      success: true,
      message: 'Event listener stopped successfully',
      data: globalEventListener.getStatus()
    });

  } catch (error) {
    console.error('Error stopping listener:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to stop event listener: ${error.message}`
    }, { status: 500 });
  }
}

// PUT - 更新监听器配置
export async function PUT(request: NextRequest) {
  try {
    const { rpcUrl, programId } = await request.json();

    // 验证输入
    if (rpcUrl && typeof rpcUrl !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid RPC URL'
      }, { status: 400 });
    }

    if (programId && typeof programId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid Program ID'
      }, { status: 400 });
    }

    // 如果监听器正在运行，需要先停止
    if (globalEventListener?.getStatus().isRunning) {
      return NextResponse.json({
        success: false,
        error: 'Cannot update configuration while listener is running. Stop the listener first.'
      }, { status: 400 });
    }

    // 更新配置
    if (rpcUrl) CONFIG.RPC_URL = rpcUrl;
    if (programId) CONFIG.PROGRAM_ID = programId;

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      data: {
        rpcUrl: CONFIG.RPC_URL,
        programId: CONFIG.PROGRAM_ID
      }
    });

  } catch (error) {
    console.error('Error updating configuration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update configuration'
    }, { status: 500 });
  }
}