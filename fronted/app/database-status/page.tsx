'use client';

import { useState, useEffect } from 'react';

interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    name?: string;
    tables?: string[];
    error?: string;
  };
  performance: {
    connectionTime?: number;
    queryTime?: number;
  };
  detailed?: {
    tableCount?: number;
    writeTest?: boolean;
    connectionPool?: boolean;
  };
}

export default function DatabaseStatusPage() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async (detailed = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const { apiClient } = await import('@/lib/apiClient');
      const data = detailed
        ? await apiClient.post('/api/database/health', {
            includeTableInfo: true,
            testWrite: true,
          }, { timeoutMs: 8000 })
        : await apiClient.get('/api/database/health', { timeoutMs: 8000 });
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getStatusColor = (status: string) => {
    return status === 'healthy' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusBg = (status: string) => {
    return status === 'healthy' ? 'bg-green-100' : 'bg-red-100';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">数据库连接状态</h1>
            <div className="space-x-2">
              <button
                onClick={() => checkHealth(false)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '检查中...' : '快速检查'}
              </button>
              <button
                onClick={() => checkHealth(true)}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? '检查中...' : '详细检查'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <strong>错误:</strong> {error}
            </div>
          )}

          {health && (
            <div className="space-y-6">
              {/* 总体状态 */}
              <div className={`p-4 rounded-md ${getStatusBg(health.status)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">总体状态</h2>
                    <p className={`text-lg font-medium ${getStatusColor(health.status)}`}>
                      {health.status === 'healthy' ? '✅ 健康' : '❌ 异常'}
                    </p>
                  </div>
                  <div className="text-sm text-gray-600">
                    检查时间: {formatTimestamp(health.timestamp)}
                  </div>
                </div>
              </div>

              {/* 数据库信息 */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">数据库信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">连接状态:</span>
                    <span className={`ml-2 ${health.database.connected ? 'text-green-600' : 'text-red-600'}`}>
                      {health.database.connected ? '✅ 已连接' : '❌ 未连接'}
                    </span>
                  </div>
                  {health.database.name && (
                    <div>
                      <span className="font-medium">数据库名:</span>
                      <span className="ml-2 text-blue-600">{health.database.name}</span>
                    </div>
                  )}
                  {health.database.error && (
                    <div className="col-span-2">
                      <span className="font-medium text-red-600">错误信息:</span>
                      <p className="mt-1 text-red-600 bg-red-50 p-2 rounded">{health.database.error}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 性能指标 */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">性能指标</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {health.performance.connectionTime !== undefined && (
                    <div>
                      <span className="font-medium">连接时间:</span>
                      <span className="ml-2 text-blue-600">{health.performance.connectionTime}ms</span>
                    </div>
                  )}
                  {health.performance.queryTime !== undefined && (
                    <div>
                      <span className="font-medium">查询时间:</span>
                      <span className="ml-2 text-blue-600">{health.performance.queryTime}ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 数据表信息 */}
              {health.database.tables && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    数据表 ({health.database.tables.length} 个)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {health.database.tables.map((table, index) => (
                      <div key={index} className="bg-white p-2 rounded border text-sm">
                        {table}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 详细测试结果 */}
              {health.detailed && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">详细测试结果</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="font-medium">表数量:</span>
                      <span className="ml-2 text-blue-600">{health.detailed.tableCount}</span>
                    </div>
                    <div>
                      <span className="font-medium">写入测试:</span>
                      <span className={`ml-2 ${health.detailed.writeTest ? 'text-green-600' : 'text-red-600'}`}>
                        {health.detailed.writeTest ? '✅ 通过' : '❌ 失败'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">连接池测试:</span>
                      <span className={`ml-2 ${health.detailed.connectionPool ? 'text-green-600' : 'text-red-600'}`}>
                        {health.detailed.connectionPool ? '✅ 通过' : '❌ 失败'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!health && !loading && !error && (
            <div className="text-center py-8 text-gray-500">
              点击上方按钮开始检查数据库连接状态
            </div>
          )}
        </div>
      </div>
    </div>
  );
}