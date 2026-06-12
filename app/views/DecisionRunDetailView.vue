<script setup lang="ts">
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  FileJson,
  GitBranch,
  RotateCcw,
} from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  auditJson,
  auditSummary,
} from "../data/mockData.js";
import { loadDecisionRunDetail } from "../api/decisionRuns.js";

const route = useRoute();
const toast = ref("");

const run = computed(() => ({
  ...loadDecisionRunDetail(typeof route.params.runId === "string" ? route.params.runId : "run_glm_1"),
}));

async function copyText(label: string, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} 已复制到剪贴板。`);
  } catch {
    showToast(`${label} 复制失败，请手动复制。`);
  }
}

function showToast(message: string): void {
  toast.value = message;
  window.setTimeout(() => {
    if (toast.value === message) {
      toast.value = "";
    }
  }, 2600);
}
</script>

<template>
  <main class="app-shell detail-page">
    <header class="top-bar">
      <div class="detail-breadcrumb">
        <RouterLink class="back-link" to="/">
          <ArrowLeft :size="15" />
          Dashboard
        </RouterLink>
        <span>Decision Run · {{ run.id }}</span>
      </div>
      <div class="detail-actions">
        <button type="button" class="secondary-action" @click="copyText('摘要', auditSummary(run))">
          <Copy :size="14" />
          复制摘要
        </button>
        <button type="button" class="secondary-action" @click="copyText('审计 JSON', auditJson(run))">
          <FileJson :size="14" />
          复制审计 JSON
        </button>
        <button
          type="button"
          class="secondary-action danger-action"
          @click="showToast('重新运行会消耗 GLM/token；当前 demo 不会自动重跑。')"
        >
          <RotateCcw :size="14" />
          重新运行
        </button>
      </div>
    </header>

    <section v-if="toast" class="toast" role="status">
      {{ toast }}
    </section>

    <section class="detail-hero">
      <article class="panel run-summary-panel">
        <p class="eyebrow">GLM-5.1 Long-Horizon Audit</p>
        <h1>{{ run.topic }}</h1>
        <p>
          Final Decision 选择 {{ run.finalDecision.action }}。本次运行展示 Agent 自主计划、工具调用、
          轨迹校验失败、自我修复和 Sepolia 审计锚点准备，不代表真实 Polymarket 下单。
        </p>
      </article>
      <aside class="panel run-state-panel">
        <dl>
          <div><dt>Final Decision</dt><dd class="tone-preview">{{ run.finalDecision.action }}</dd></div>
          <div><dt>Risk</dt><dd class="tone-low">{{ run.riskLevel }}</dd></div>
          <div><dt>Audit</dt><dd class="tone-anchor-text">{{ run.auditStatus }}</dd></div>
          <div><dt>Execution</dt><dd>{{ run.executionRecord.status }}</dd></div>
        </dl>
      </aside>
    </section>

    <div class="detail-grid">
      <section class="panel timeline-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Agent Run Trace</p>
            <h2>6 步长程审计轨迹</h2>
          </div>
          <GitBranch :size="20" class="muted-icon" />
        </div>

        <button
          v-for="step in run.agentRunTrace"
          :key="step.index"
          :class="['timeline-stage', step.status === 'failed' ? 'active' : 'complete']"
          type="button"
        >
          <span class="timeline-dot" />
          <span class="timeline-content">
            <strong>Step {{ step.index }} · {{ step.title }}</strong>
            <small>{{ step.tool }}</small>
            <span class="timeline-expanded">
              {{ step.observation }}
            </span>
          </span>
        </button>
      </section>

      <section class="detail-center-column">
        <article class="final-panel">
          <p class="eyebrow">展开阶段 · 自我修复后决策</p>
          <h2>{{ run.finalDecision.action }}</h2>
          <p>{{ run.finalDecision.rationale }}</p>
          <div class="final-chip-row">
            <span>selected {{ run.finalDecision.selectedRecommendationId ?? 'none' }}</span>
            <span>veto: {{ run.finalDecision.vetoConditions.length ? run.finalDecision.vetoConditions.join(', ') : 'none' }}</span>
            <span>execution: deferred</span>
          </div>
        </article>

        <section class="panel evidence-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Evidence citations</p>
              <h2>证据引用级审计</h2>
            </div>
            <p class="subtle">不展示 chain-of-thought</p>
          </div>
          <article
            v-for="review in run.evidenceReviews"
            :key="review.lens"
            class="evidence-card"
          >
            <span class="lens-accent" />
            <div>
              <strong>{{ review.lens }} · {{ review.action }}</strong>
              <p>{{ review.rationale }}</p>
              <small>证据引用: {{ review.evidenceRefs.join(' · ') }}</small>
            </div>
          </article>
        </section>

        <section class="panel audit-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Clickable audit refs</p>
              <h2>Sepolia 锚点与复制证据</h2>
            </div>
            <ExternalLink :size="18" class="muted-icon" />
          </div>
          <dl>
            <div v-for="ref in run.auditReferences" :key="ref.label">
              <dt>{{ ref.label }}</dt>
              <dd>
                <a v-if="ref.href" class="audit-link" :href="ref.href" target="_blank" rel="noreferrer">
                  {{ ref.value }}
                </a>
                <span v-else>{{ ref.value }}</span>
              </dd>
            </div>
          </dl>
        </section>
      </section>

      <aside class="detail-right-rail">
        <section class="panel strategy-panel snapshot-panel">
          <p class="eyebrow">Hash material</p>
          <h2>审计载荷</h2>
          <p class="panel-note">
            Trace Hash 和 calldata 是可复制验证材料；真实发送后 Explorer 会指向 Sepolia Etherscan 交易。
          </p>
          <dl>
            <div><dt>traceHash</dt><dd>{{ run.traceHash }}</dd></div>
            <div><dt>calldata</dt><dd>{{ run.calldata }}</dd></div>
            <div><dt>explorer</dt><dd>{{ run.explorerLink }}</dd></div>
            <div><dt>agentRunRecord</dt><dd>demo/agent-run-record.latest.json</dd></div>
          </dl>
          <div class="snapshot-actions">
            <button type="button" class="secondary-action" @click="copyText('Trace Hash', run.traceHash)">
              复制 Trace Hash
            </button>
            <button type="button" class="secondary-action" @click="copyText('Calldata', run.calldata)">
              复制 Calldata
            </button>
          </div>
        </section>

        <section class="panel execution-panel">
          <p class="eyebrow">V2 boundary</p>
          <h2>Cobo 钱包执行</h2>
          <p class="panel-note">
            当前 MVP 只演示可审计链路。Cobo Wallet Executor、真实 Polymarket 买入和 Investment Plan 参数窗口属于 V2。
          </p>
          <dl>
            <div><dt>executionRecord</dt><dd>{{ run.executionRecord.id }}</dd></div>
            <div><dt>status</dt><dd>{{ run.executionRecord.status }}</dd></div>
            <div><dt>cobo</dt><dd class="tone-preview">V2 preview</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  </main>
</template>
