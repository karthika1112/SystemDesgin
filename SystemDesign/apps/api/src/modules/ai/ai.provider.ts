export interface IAIProvider {
  generateText(prompt: string, context?: any): Promise<string>;
  generateJSON<T>(prompt: string, context?: any): Promise<T>;
}

export class MockAIProvider implements IAIProvider {
  async generateText(prompt: string, context?: any): Promise<string> {
    // Generate deterministic insights based on provided context
    if (prompt.includes('Summary')) {
      const confirmed = context?.orders?.confirmed || 0;
      return `Based on recent data, the flash sale is performing steadily. We have ${confirmed} confirmed orders. Conversion rates are optimal.`;
    }
    if (prompt.includes('Incident')) {
      return `Incident Explanation: High latency was observed likely due to database connection exhaustion during peak traffic. Recommended action: increase connection pool.`;
    }
    if (prompt.includes('Query')) {
      return `Natural Language Response: The current dashboard metrics show an active flash sale with ${context?.inventory?.available || 0} items remaining.`;
    }
    
    return `AI Copilot Insight: Processed request safely. Context loaded. Metrics nominal.`;
  }

  async generateJSON<T>(prompt: string, context?: any): Promise<T> {
    if (prompt.includes('Copilot Summary')) {
      const { inventory, reservations, payments, queueDepth, system } = context;
      
      let healthScore = 100;
      let riskLevel = 'LOW';
      const keyInsights = [];
      const recommendations = [];
      const alerts = [];

      // Metric Extraction
      const payTotal = (payments.SUCCESS || 0) + (payments.FAILED || 0) + (payments.TIMEOUT || 0);
      const payFailRate = payTotal > 0 ? ((payments.FAILED || 0) + (payments.TIMEOUT || 0)) / payTotal : 0;
      
      const invTotal = inventory.available + inventory.reserved + inventory.sold;
      
      // AI Logic: Inventory Pressure
      if (inventory.available > 0 && inventory.available < invTotal * 0.2) {
        keyInsights.push({
          insight: "Inventory pressure is HIGH because reservation success rate is increasing while available stock is approaching zero.",
          confidence: 0.94,
          evidence: ["available_inventory", "reservation_success_rate"]
        });
        healthScore -= 10;
        riskLevel = 'MEDIUM';
        recommendations.push("Prepare dynamic out-of-stock banners for the frontend UI.");
      }

      // AI Logic: Payment Gateway Failure Analysis
      if (payFailRate > 0.1) {
        keyInsights.push({
          insight: "Payment failure rate is above baseline. Investigate gateway latency.",
          confidence: 0.89,
          evidence: ["payment_failure_rate", "gateway_latency"]
        });
        healthScore -= 20;
        riskLevel = 'HIGH';
        alerts.push(`Payment Gateway Failure Rate is ${(payFailRate * 100).toFixed(1)}%`);
        recommendations.push("Verify Circuit Breaker threshold limits and check third-party provider status.");
      }

      // AI Logic: RabbitMQ Queue Depth
      if (queueDepth > 50) {
        keyInsights.push({
          insight: "RabbitMQ backlog is increasing. Consider increasing consumer capacity.",
          confidence: 0.98,
          evidence: ["queue_depth"]
        });
        healthScore -= 15;
        if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
        recommendations.push("Scale up Notification and Order Consumer worker pods.");
      }
      
      if (healthScore < 60) riskLevel = 'CRITICAL';

      return {
        summary: `The flash sale system is operating at a health score of ${healthScore}/100. Overall risk assessment is ${riskLevel}.`,
        healthScore,
        riskLevel,
        keyInsights,
        recommendations,
        alerts
      } as T;
    }

    if (prompt.includes('System Anomalies')) {
      const { payments, queueDepth, system, inventory, orders } = context;
      const anomalies = [];
      const { randomUUID } = require('crypto');

      // 1. Payment Failure Spike
      const pTotal = (payments.SUCCESS || 0) + (payments.FAILED || 0) + (payments.TIMEOUT || 0);
      const pFailRate = pTotal > 0 ? ((payments.FAILED || 0) + (payments.TIMEOUT || 0)) / pTotal * 100 : 0;
      if (pFailRate > 10) {
        anomalies.push({
          id: randomUUID(), type: 'PAYMENT_SPIKE', severity: pFailRate > 30 ? 'CRITICAL' : 'HIGH',
          detectedAt: new Date().toISOString(), metric: 'payment_failure_rate',
          currentValue: parseFloat(pFailRate.toFixed(1)), expectedRange: '2-8%',
          explanation: `Payment failures normally 2-8%. Current payment failures ${pFailRate.toFixed(1)}%.`,
          recommendedAction: 'Verify payment gateway health and circuit breaker state.', confidence: 0.95
        });
      }

      // 2. Queue Backlog
      if (queueDepth > 100) {
        anomalies.push({
          id: randomUUID(), type: 'QUEUE_BACKLOG', severity: queueDepth > 500 ? 'CRITICAL' : 'WARNING',
          detectedAt: new Date().toISOString(), metric: 'outbox_queue_depth',
          currentValue: queueDepth, expectedRange: '0-100 messages',
          explanation: `Queue depth of ${queueDepth} exceeds normal operating thresholds.`,
          recommendedAction: 'Scale up background worker instances.', confidence: 0.99
        });
      }

      // 3. API Error Increase
      const errRate = system.reqTotal > 0 ? (system.reqErrors / system.reqTotal) * 100 : 0;
      if (errRate > 5) {
        anomalies.push({
          id: randomUUID(), type: 'API_ERROR_INCREASE', severity: errRate > 10 ? 'CRITICAL' : 'HIGH',
          detectedAt: new Date().toISOString(), metric: 'api_error_rate',
          currentValue: parseFloat(errRate.toFixed(1)), expectedRange: '< 2%',
          explanation: `API errors spiked to ${errRate.toFixed(1)}%. Expected is < 2%.`,
          recommendedAction: 'Inspect Fastify error logs immediately.', confidence: 0.96
        });
      }

      // 4. Unusual Latency
      const avgLatency = system.reqTotal > 0 ? (system.latencySum / system.reqTotal) : 0;
      if (avgLatency > 500) {
        anomalies.push({
          id: randomUUID(), type: 'UNUSUAL_LATENCY', severity: avgLatency > 1000 ? 'CRITICAL' : 'WARNING',
          detectedAt: new Date().toISOString(), metric: 'avg_latency_ms',
          currentValue: parseFloat(avgLatency.toFixed(1)), expectedRange: '< 500ms',
          explanation: `API latency degraded to ${avgLatency.toFixed(0)}ms. Expected < 500ms.`,
          recommendedAction: 'Check Database connection pool and Redis IOPS.', confidence: 0.92
        });
      }

      // 5. Inventory Mismatch
      if (inventory.available < 0) {
        anomalies.push({
          id: randomUUID(), type: 'INVENTORY_MISMATCH', severity: 'CRITICAL',
          detectedAt: new Date().toISOString(), metric: 'available_inventory',
          currentValue: inventory.available, expectedRange: '>= 0',
          explanation: 'Physical impossibility: available inventory has dropped below 0.',
          recommendedAction: 'Halt sales. Audit reservation lifecycle state machine.', confidence: 1.0
        });
      }

      // 6. Abnormal Cancellation
      const oTotal = (orders.CONFIRMED || 0) + (orders.CANCELLED || 0);
      const oCancRate = oTotal > 0 ? (orders.CANCELLED || 0) / oTotal * 100 : 0;
      if (oCancRate > 15) {
        anomalies.push({
          id: randomUUID(), type: 'ABNORMAL_CANCELLATION', severity: 'HIGH',
          detectedAt: new Date().toISOString(), metric: 'order_cancellation_rate',
          currentValue: parseFloat(oCancRate.toFixed(1)), expectedRange: '0-5%',
          explanation: `Order cancellation rate is ${oCancRate.toFixed(1)}%. Normal is 0-5%.`,
          recommendedAction: 'Review Auto-Reconciliation worker metrics.', confidence: 0.88
        });
      }

      // 7. Duplicate Requests (Mock Support)
      if (system.duplicates > 1000) {
        anomalies.push({
          id: randomUUID(), type: 'REPEATED_DUPLICATE_REQUESTS', severity: 'WARNING',
          detectedAt: new Date().toISOString(), metric: 'duplicate_idempotency_hits',
          currentValue: system.duplicates, expectedRange: '< 1000',
          explanation: 'Large volume of duplicate idempotency keys detected, likely frontend retry storm.',
          recommendedAction: 'Check frontend circuit breakers.', confidence: 0.90
        });
      }

      return anomalies as T;
    }

    if (prompt.includes('Inventory Risk')) {
      const available = context?.inventory?.available || 0;
      const riskLevel = available < 10 ? 'CRITICAL' : available < 50 ? 'MEDIUM' : 'LOW';
      return {
        riskLevel,
        estimatedDepletionMinutes: available > 0 ? Math.max(1, Math.floor(available / 5)) : 0,
        recommendation: available < 10 ? 'Prepare out-of-stock messaging immediately.' : 'Stock levels healthy.'
      } as T;
    }
    
    if (prompt.includes('Traffic Anomaly')) {
      const qDepth = context?.system?.queueDepth || 0;
      const hasAnomaly = qDepth > 100;
      return {
        anomalyDetected: hasAnomaly,
        severity: hasAnomaly ? 'HIGH' : 'NONE',
        details: hasAnomaly ? `Queue depth (${qDepth}) exceeds normal thresholds.` : 'Traffic patterns normal.'
      } as T;
    }

    if (prompt.includes('Payment Failure')) {
      const failures = context?.payments?.failed || 0;
      const total = (context?.payments?.success || 0) + failures;
      const rate = total > 0 ? (failures / total) * 100 : 0;
      return {
        failureRate: rate,
        rootCause: rate > 10 ? 'Potential upstream gateway timeout.' : 'Standard user errors (NSF).',
        actionRequired: rate > 10 ? 'Check circuit breaker status.' : 'None'
      } as T;
    }

    if (prompt.includes('Forecast')) {
      return {
        predictedSalesNextHour: 4500,
        confidenceInterval: '85%',
        trend: 'UPWARD'
      } as T;
    }

    if (prompt.includes('Simulate')) {
      const users = context?.users || 10000;
      const success = Math.min(100, Math.floor(users * 0.05));
      return {
        scenario: 'What-If Simulation',
        simulatedSuccessfulCheckouts: success,
        projectedDatabaseLoad: users > 5000 ? 'HIGH' : 'NORMAL',
        riskOfOverselling: '0% (Strict ACID locks active)'
      } as T;
    }

    if (prompt.includes('Recommendations')) {
      return {
        immediateActions: ['Scale up API pods to handle incoming traffic spike.'],
        longTermStrategies: ['Implement caching for product catalog.']
      } as T;
    }

    if (prompt.includes('NL Operations Assistant')) {
      const { intent, metrics } = context;
      let answer = 'Metrics are operating within normal parameters.';
      let evidence: string[] = [];
      let confidence = 0.90;

      if (Object.keys(metrics).length === 0 || (metrics.totalRequests === 0)) {
        answer = 'Data is currently insufficient to provide a conclusive answer for this time range.';
        confidence = 0.50;
      } else {
        if (intent === 'PAYMENT_HEALTH') {
           const fail = (metrics.FAILED || 0) + (metrics.TIMEOUT || 0);
           const total = (metrics.SUCCESS || 0) + fail;
           if (total === 0) answer = 'No payment data available in this time window. Insufficient data.';
           else if (fail / total > 0.1) answer = `Payments are failing at an elevated rate of ${((fail/total)*100).toFixed(1)}%. Check upstream gateway.`;
           else answer = `Payment health is normal. Failure rate is safely below threshold.`;
           evidence = ['payment_status_distribution'];
        }
        else if (intent === 'INVENTORY_STATUS') {
           if (metrics.available < 0) answer = 'CRITICAL: Overselling detected! Mathematical lock breached.';
           else if (metrics.available === 0) answer = 'Inventory is fully depleted. Zero overselling maintained.';
           else answer = `We have ${metrics.available} units remaining. No overselling detected.`;
           evidence = ['availableQuantity', 'reservedQuantity'];
        }
        else if (intent === 'QUEUE_HEALTH') {
           if (metrics.pendingMessages > 100) answer = `RabbitMQ backlog is increasing. We have ${metrics.pendingMessages} unprocessed events.`;
           else answer = 'RabbitMQ backlog is healthy and clearing rapidly.';
           evidence = ['pending_outbox_events'];
        }
        else if (intent === 'CHECKOUT_LATENCY') {
           const avg = metrics.latencySum / Math.max(1, metrics.totalRequests);
           if (avg > 500) answer = `Checkout is slow. Average latency is ${avg.toFixed(0)}ms.`;
           else answer = `Checkout speed is optimal. Average latency is ${avg.toFixed(0)}ms.`;
           evidence = ['avg_latency'];
        }
      }

      return {
        answer,
        metrics,
        evidence,
        confidence,
        suggestedQuestions: [
          'What is the current reservation success rate?',
          'Is the payment gateway healthy?',
          'Which product is under the most pressure?'
        ]
      } as T;
    }

    if (prompt.includes('User Risk Profile')) {
      const { failedPayments, reservationAttempts, duplicateRequests, config } = context;
      let riskScore = 0;
      const signals = [];

      if (failedPayments > config.MAX_FAILED_PAYMENTS) {
        riskScore += 40;
        signals.push('EXCESSIVE_FAILED_PAYMENTS');
      }
      if (reservationAttempts > config.MAX_RESERVATION_ATTEMPTS) {
        riskScore += 30;
        signals.push('EXCESSIVE_RESERVATION_ATTEMPTS');
      }
      if (duplicateRequests > config.MAX_DUPLICATE_REQUESTS) {
        riskScore += 30;
        signals.push('EXCESSIVE_DUPLICATE_REQUESTS');
      }

      let riskLevel = 'LOW';
      let recommendedAction = 'No action required.';
      let explanation = 'User behavior is within normal operating thresholds.';

      if (riskScore >= 70) {
         riskLevel = 'CRITICAL';
         recommendedAction = 'Flag for manual review and consider temporary IP rate limit penalty. Do NOT automatically ban without deterministic policy enforcement.';
         explanation = 'User exhibits multiple severe abuse vectors characteristic of a bot or scalper.';
      } else if (riskScore >= 40) {
         riskLevel = 'HIGH';
         recommendedAction = 'Enable CAPTCHA on checkout for this user.';
         explanation = 'User exhibits highly suspicious payment or reservation velocity.';
      } else if (riskScore >= 20) {
         riskLevel = 'MEDIUM';
         recommendedAction = 'Monitor closely.';
         explanation = 'User exhibits mildly abnormal activity rates.';
      }

      return {
        riskScore, riskLevel, signals, explanation, recommendedAction
      } as T;
    }

    return {} as T;
  }
}

export class AIFactory {
  static getProvider(): IAIProvider {
    const isEnabled = process.env.AI_ENABLED === 'true';
    if (!isEnabled) {
      throw new Error('AI Services are currently disabled via environment configuration.');
    }

    const providerName = process.env.AI_PROVIDER || 'mock';
    switch (providerName.toLowerCase()) {
      case 'mock':
      default:
        return new MockAIProvider();
    }
  }
}
