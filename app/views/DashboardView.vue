<script setup lang="ts">
import {
  Activity,
  Bell,
  Bot,
  ExternalLink,
  Gauge,
  Plus,
  ShieldCheck,
} from "@lucide/vue";
import { RouterLink } from "vue-router";
import {
  decisionRuns,
  monitoredMarkets,
  strategyParameters,
  systemStatuses,
  type DecisionRunCard,
} from "../data/mockData.js";
import { ref } from "vue";

const toast = ref("");

const metricCards = [
  { value: "18", label: "今日获取盘口", tone: "chain" },
  { value: "3", label: "候选通过", tone: "preview" },
  { value: "1", label: "审计锚定", tone: "anchor" },
  { value: "0", label: "真实交易", tone: "muted" },
] as const;

function previewNotice(message: string): void {
  toast.value = message;
  window.setTimeout(() => {
    if (toast.value === message) {
      toast.value = "";
    }
  }, 2600);
}

function chipClass(run: DecisionRunCard, chip: string): string {
  if (chip === "VETO") return "chip chip-danger";
  if (chip === "ANCHOR") return "chip chip-anchor";
  if (run.riskLevel === "LOW" && chip === "LOW") return "chip chip-low";
  if (run.riskLevel === "MEDIUM" && chip === "MEDIUM") return "chip chip-medium";
  return "chip";
}
</script>

<template>
  <main class="app-shell dashboard-page">
    <header class="top-bar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark" />
        <span>ColdRead Dashboard</span>
      </RouterLink>
      <nav class="top-nav" aria-label="Primary navigation">
        <a class="active">首页</a>
        <a>Decision Runs</a>
        <a>策略参数</a>
        <a>审计</a>
      </nav>
      <button class="primary-action" type="button">
        <Plus :size="16" />
        新建 Decision Topic
      </button>
    </header>

    <section v-if="toast" class="toast" role="status">
      {{ toast }}
    </section>

    <div class="dashboard-grid">
      <section class="left-column">
        <section class="panel system-panel" aria-labelledby="system-status-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow">System Health</p>
              <h2 id="system-status-title">系统级状态</h2>
            </div>
            <ShieldCheck :size="20" class="muted-icon" />
          </div>
          <div class="system-status-grid">
            <button
              v-for="status in systemStatuses"
              :key="status.name"
              class="system-card"
              type="button"
              @click="status.name === 'Cobo'
                ? previewNotice('Cobo 执行是 V2 预览，当前不会真实操作钱包。')
                : undefined"
            >
              <span class="caption">{{ status.name }}</span>
              <span class="status-line">
                <span :class="['status-dot', `tone-${status.tone}`]" />
                <span>{{ status.status }}</span>
              </span>
            </button>
          </div>
        </section>

        <section class="panel current-run">
          <div class="current-run-copy">
            <p class="eyebrow">当前 Decision Run</p>
            <h1>美联储会在 7 月降息吗？</h1>
            <p>
              正在运行 External Risk Lens。下一步将选择 Final Decision；本次运行不会自动触发钱包执行。
            </p>
          </div>
          <div class="stage-strip" aria-label="Current Decision Run stage">
            <div
              v-for="(stage, index) in ['收到主题', '获取盘口', '筛选与确认', '冻结证据', 'Agent 建议', '最终决策', '审计锚定', '确认与执行']"
              :key="stage"
              class="stage-row"
            >
              <span
                :class="[
                  'stage-bar',
                  index < 4 ? 'complete' : index === 4 ? 'active' : '',
                ]"
              />
              <span>{{ stage }}</span>
            </div>
          </div>
        </section>

        <section class="metric-grid" aria-label="Statistics">
          <article v-for="metric in metricCards" :key="metric.label" class="panel metric-card">
            <strong :class="`metric-${metric.tone}`">{{ metric.value }}</strong>
            <span>{{ metric.label }}</span>
          </article>
        </section>

        <section class="panel recent-runs">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Decision Run cards</p>
              <h2>最近 Decision Run</h2>
            </div>
            <p class="subtle">卡片流 · 非事件日志</p>
          </div>
          <RouterLink
            v-for="run in decisionRuns"
            :key="run.id"
            class="run-card"
            :to="`/runs/${run.id}`"
          >
            <div class="run-card-main">
              <strong>{{ run.id }} · {{ run.topic }}</strong>
              <span>{{ run.stage }} · 策略: {{ run.strategyName }} · Amoy preview</span>
            </div>
            <span :class="chipClass(run, run.finalAction)">{{ run.finalAction }}</span>
            <span :class="chipClass(run, run.riskLevel)">{{ run.riskLevel }}</span>
            <span :class="chipClass(run, run.auditStatus)">{{ run.auditStatus }}</span>
            <span :class="chipClass(run, run.executionStatus)">{{ run.executionStatus }}</span>
            <span class="open-link">
              打开详情
              <ExternalLink :size="13" />
            </span>
          </RouterLink>
        </section>
      </section>

      <aside class="right-column">
        <section class="panel watch-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">V2 surface</p>
              <h2>监控盘口</h2>
            </div>
            <button
              class="preview-badge"
              type="button"
              @click="previewNotice('监控盘口是 V2 预览，当前数据为演示，不会启动后台 watchlist。')"
            >
              V2 Preview
            </button>
          </div>
          <button
            v-for="market in monitoredMarkets"
            :key="market.question"
            class="market-row"
            type="button"
            @click="previewNotice('监控盘口是 V2 预览，当前不会触发后台任务。')"
          >
            <span>{{ market.question }}</span>
            <small>{{ market.price }} · {{ market.status }}</small>
          </button>
        </section>

        <section class="panel strategy-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Global defaults</p>
              <h2>Strategy Parameters</h2>
            </div>
            <Gauge :size="20" class="muted-icon" />
          </div>
          <p class="panel-note">全局默认策略。保存后只影响未来运行，不会自动重跑 Agent。</p>

          <div class="parameter-group">
            <h3>Risk Limits</h3>
            <dl>
              <div><dt>maxStakePerMarket</dt><dd>{{ strategyParameters.maxStakePerMarket }}</dd></div>
              <div><dt>dailyRiskBudget</dt><dd>{{ strategyParameters.dailyRiskBudget }}</dd></div>
            </dl>
          </div>
          <div class="parameter-group">
            <h3>Market Gates</h3>
            <dl>
              <div><dt>minimumLiquidity</dt><dd>{{ strategyParameters.minimumLiquidity }}</dd></div>
              <div><dt>minimumHoursUntilClose</dt><dd>{{ strategyParameters.minimumHoursUntilClose }}</dd></div>
              <div><dt>oneSidedPriceThreshold</dt><dd>{{ strategyParameters.oneSidedPriceThreshold }}</dd></div>
              <div><dt>minimumConfidence</dt><dd>{{ strategyParameters.minimumConfidence }}</dd></div>
            </dl>
          </div>
          <div class="parameter-group">
            <h3>Execution Rules</h3>
            <dl>
              <div><dt>allowedActions</dt><dd>BUY_YES / BUY_NO / HOLD</dd></div>
              <div><dt>vetoOnMajorCounterevidence</dt><dd>ON</dd></div>
              <div><dt>requiresUserApproval</dt><dd>ON</dd></div>
              <div><dt>executionNetwork</dt><dd>{{ strategyParameters.executionNetwork }}</dd></div>
            </dl>
          </div>
        </section>
      </aside>
    </div>
  </main>
</template>
