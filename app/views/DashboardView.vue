<script setup lang="ts">
import {
  ExternalLink,
  Gauge,
  Plus,
  ShieldCheck,
} from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  monitoredMarkets,
  strategyParameters,
  systemStatuses,
  type DecisionRunCard,
} from "../data/mockData.js";
import {
  loadDecisionRunCards,
  submitDecisionTopic,
} from "../api/decisionRuns.js";

const toast = ref("");
const router = useRouter();
const topicText = ref("New Rihanna Album before GTA VI?");
const isSubmitting = ref(false);
const submittedRunCards = ref(loadDecisionRunCards());
const runCards = computed(() => submittedRunCards.value);

const metricCards = [
  { value: "6", label: "GLM 长程步骤", tone: "chain" },
  { value: "1", label: "校验失败后修复", tone: "preview" },
  { value: "1", label: "Sepolia 锚点准备", tone: "anchor" },
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
  if (chip === "HOLD") return "chip chip-medium";
  if (run.riskLevel === "LOW" && chip === "LOW") return "chip chip-low";
  if (run.riskLevel === "MEDIUM" && chip === "MEDIUM") return "chip chip-medium";
  return "chip";
}

async function runDecisionTopic(): Promise<void> {
  if (topicText.value.trim() === "") {
    previewNotice("请输入 Decision Topic（决策主题）。");
    return;
  }

  isSubmitting.value = true;
  const result = await submitDecisionTopic(topicText.value);
  isSubmitting.value = false;

  if (result.kind === "decision_run_complete") {
    submittedRunCards.value = loadDecisionRunCards();
    await router.push(`/runs/${result.detail.id}`);
    return;
  }

  previewNotice(result.message);
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
        <a>GLM Agent</a>
        <a>审计证据</a>
        <a>V2 钱包</a>
      </nav>
      <button class="primary-action" type="button" :disabled="isSubmitting" @click="runDecisionTopic">
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
              <p class="eyebrow">Hackathon proof path</p>
              <h2 id="system-status-title">GLM-5.1 长程审计状态</h2>
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
                ? previewNotice('Cobo 钱包执行是 V2，当前 MVP 只展示可审计链路。')
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
            <p class="eyebrow">当前 Demo Run</p>
            <h1>New Rihanna Album before GTA VI?</h1>
            <p>
              GLM-5.1 正在作为长程 Agent：拆解任务、读取真实 Polymarket 盘口、校验轨迹、完成自我修复，并准备 Sepolia 审计锚点。
            </p>
          </div>
          <form class="topic-form" @submit.prevent="runDecisionTopic">
            <label for="topic-input-main">Decision Topic（决策主题）</label>
            <div class="topic-form-row">
              <input
                id="topic-input-main"
                v-model="topicText"
                type="text"
                placeholder="例如：New Rihanna Album before GTA VI?"
                :disabled="isSubmitting"
              />
              <button class="primary-action" type="submit" :disabled="isSubmitting">
                {{ isSubmitting ? "运行中..." : "运行" }}
              </button>
            </div>
            <small>CLI 主演示命令：npm run demo:agent -- --market ... --require-live --pretty</small>
          </form>
          <div class="stage-strip" aria-label="Current Decision Run stage">
            <div
              v-for="(stage, index) in ['任务拆解', '读取盘口', '轨迹草稿', '校验失败', '自我修复', '锚点准备']"
              :key="stage"
              class="stage-row"
            >
              <span
                :class="[
                  'stage-bar',
                  index < 5 ? 'complete' : index === 5 ? 'active' : '',
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
              <h2>最近审计运行</h2>
            </div>
            <p class="subtle">GLM trace · Sepolia anchor</p>
          </div>
          <RouterLink
            v-for="run in runCards"
            :key="run.id"
            class="run-card"
            :to="`/runs/${run.id}`"
          >
            <div class="run-card-main">
              <strong>{{ run.id }} · {{ run.topic }}</strong>
              <span>{{ run.stage }} · 策略: {{ run.strategyName }}</span>
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
              <p class="eyebrow">Market material</p>
              <h2>演示盘口</h2>
            </div>
            <button
              class="preview-badge"
              type="button"
              @click="previewNotice('当前不会自动扫市场；--market slug 仍由演示者指定。')"
            >
              Manual Slug
            </button>
          </div>
          <button
            v-for="market in monitoredMarkets"
            :key="market.question"
            class="market-row"
            type="button"
            @click="previewNotice('监控盘口是 V2，当前只展示演示材料。')"
          >
            <span>{{ market.question }}</span>
            <small>{{ market.price }} · {{ market.status }}</small>
          </button>
        </section>

        <section class="panel strategy-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Audit boundary</p>
              <h2>策略参数快照</h2>
            </div>
            <Gauge :size="20" class="muted-icon" />
          </div>
          <p class="panel-note">MVP 展示可审计推理，不执行真实交易。参数调整和 Cobo 执行进入 V2。</p>

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
