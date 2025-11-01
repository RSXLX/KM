#!/usr/bin/env tsx

import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

class DatabaseSystemTester {
  private results: TestResult[] = [];
  private baseUrl = 'http://localhost:3000';

  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
    const colors = {
      info: '\x1b[36m',    // 青色
      success: '\x1b[32m', // 绿色
      error: '\x1b[31m',   // 红色
      warn: '\x1b[33m',    // 黄色
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}${message}${reset}`);
  }

  private addResult(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration?: number): void {
    this.results.push({ name, status, message, duration });
    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    const durationText = duration ? ` (${duration}ms)` : '';
    this.log(`[${status}] ${name}: ${message}${durationText}`, 
      status === 'PASS' ? 'success' : status === 'FAIL' ? 'error' : 'warn');
  }

  async testApiHealthEndpoint(): Promise<void> {
    const startTime = Date.now();
    try {
      this.log('\n🔍 测试数据库健康检查API (GET)...', 'info');
      
      const response = await fetch(`${this.baseUrl}/api/database/health`);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'healthy') {
        this.addResult('API健康检查(GET)', 'PASS', 
          `API响应正常，数据库状态: ${data.status}，表数量: ${data.database.tables?.length || 0}`, duration);
      } else {
        this.addResult('API健康检查(GET)', 'FAIL', 
          `数据库状态异常: ${data.database.error || '未知错误'}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('API健康检查(GET)', 'FAIL', 
        `API请求失败: ${error instanceof Error ? error.message : '未知错误'}`, duration);
    }
  }

  async testApiDetailedHealthEndpoint(): Promise<void> {
    const startTime = Date.now();
    try {
      this.log('\n🔍 测试数据库详细健康检查API (POST)...', 'info');
      
      const response = await fetch(`${this.baseUrl}/api/database/health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeTableInfo: true,
          testWrite: true,
        }),
      });
      
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'healthy') {
        const details = [];
        if (data.detailed?.writeTest) details.push('写入测试通过');
        if (data.detailed?.connectionPool) details.push('连接池测试通过');
        if (data.detailed?.tableCount) details.push(`${data.detailed.tableCount}个表`);
        
        this.addResult('API详细健康检查(POST)', 'PASS', 
          `详细检查通过: ${details.join(', ')}`, duration);
      } else {
        this.addResult('API详细健康检查(POST)', 'FAIL', 
          `详细检查失败: ${data.database.error || '未知错误'}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('API详细健康检查(POST)', 'FAIL', 
        `API请求失败: ${error instanceof Error ? error.message : '未知错误'}`, duration);
    }
  }

  async testFrontendPage(): Promise<void> {
    const startTime = Date.now();
    try {
      this.log('\n🖥️ 测试前端数据库状态页面...', 'info');
      
      const response = await fetch(`${this.baseUrl}/database-status`);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // 检查页面是否包含预期内容
      const expectedContent = [
        '数据库连接状态',
        '快速检查',
        '详细检查'
      ];
      
      const missingContent = expectedContent.filter(content => !html.includes(content));
      
      if (missingContent.length === 0) {
        this.addResult('前端页面', 'PASS', 
          '页面加载成功，包含所有预期内容', duration);
      } else {
        this.addResult('前端页面', 'FAIL', 
          `页面缺少内容: ${missingContent.join(', ')}`, duration);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult('前端页面', 'FAIL', 
        `页面访问失败: ${error instanceof Error ? error.message : '未知错误'}`, duration);
    }
  }

  async testEnvironmentVariables(): Promise<void> {
    this.log('\n⚙️ 检查环境变量配置...', 'info');
    
    const requiredVars = [
      'MYSQL_URL',
      'DB_HOST',
      'DB_PORT', 
      'DB_USER',
      'DB_NAME'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      this.addResult('环境变量', 'PASS', '所有必需的环境变量都已配置');
    } else {
      this.addResult('环境变量', 'WARN', `缺少环境变量: ${missingVars.join(', ')}`);
    }
  }

  async runAllTests(): Promise<void> {
    this.log('🚀 开始数据库系统完整测试...', 'info');
    this.log('=' .repeat(60), 'info');
    
    // 运行所有测试
    await this.testEnvironmentVariables();
    await this.testApiHealthEndpoint();
    await this.testApiDetailedHealthEndpoint();
    await this.testFrontendPage();
    
    // 输出测试结果汇总
    this.printSummary();
  }

  private printSummary(): void {
    this.log('\n📊 测试结果汇总', 'info');
    this.log('=' .repeat(60), 'info');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      const durationText = result.duration ? ` (${result.duration}ms)` : '';
      this.log(`${statusIcon} ${result.name}: ${result.message}${durationText}`);
    });
    
    this.log('\n📈 统计信息:', 'info');
    this.log(`  通过: ${passed}`, 'success');
    this.log(`  失败: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`  跳过: ${skipped}`, skipped > 0 ? 'warn' : 'info');
    this.log(`  总计: ${total}`, 'info');
    
    if (failed === 0) {
      this.log('\n🎉 所有测试通过！数据库系统运行正常。', 'success');
      process.exit(0);
    } else {
      this.log('\n⚠️ 部分测试失败，请检查系统配置。', 'error');
      process.exit(1);
    }
  }
}

// 运行测试
const tester = new DatabaseSystemTester();
tester.runAllTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});