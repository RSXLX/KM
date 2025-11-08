'use client';

import React from 'react';
import { CheckCircle, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionSignature?: string;
  amount?: number;
  selectedTeam?: string;
  payout?: number;
  network?: string;
}

export function PaymentSuccessModal({
  isOpen,
  onClose,
  transactionSignature,
  amount,
  selectedTeam,
  payout,
  network = 'devnet'
}: PaymentSuccessModalProps) {
  if (!isOpen) return null;

  const explorerUrl = `https://explorer.solana.com/tx/${transactionSignature}?cluster=${network}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 shadow-xl">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  支付成功！
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  您的下注已确认
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4 mb-6">
            {amount && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-gray-600 dark:text-gray-400">下注金额</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {amount} SOL
                </span>
              </div>
            )}
            
            {selectedTeam && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-gray-600 dark:text-gray-400">选择队伍</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedTeam}
                </span>
              </div>
            )}

            {payout && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-gray-600 dark:text-gray-400">预期收益</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {payout.toFixed(2)} SOL
                </span>
              </div>
            )}

            {transactionSignature && (
              <div className="py-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">交易签名</span>
                <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs font-mono break-all text-gray-700 dark:text-gray-300">
                  {transactionSignature}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              确定
            </Button>
            
            {transactionSignature && (
              <Button
                variant="outline"
                onClick={() => window.open(explorerUrl, '_blank')}
                className="flex items-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>查看交易</span>
              </Button>
            )}
          </div>

          {/* Success Animation */}
          <div className="mt-4 text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>交易已在区块链上确认</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}