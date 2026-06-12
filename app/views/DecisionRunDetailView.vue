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
  ...loadDecisionRunDetail(typeof route.params.runId === "string" ? route.params.runId : "run_1"),
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
        <button type="button" class="secondary-action" @click="copyText('审计包 JSON', auditJson(run))">
          <FileJson :size="14" />
          复制审计包 JSON
        </button>
        <button
          type="button"
          class="secondary-action danger-action"
          @click="showToast('用此策略重新运行会创建新的 Decision Run 并消耗 API/token；当前 UI demo 不会自动重跑。')"
        >
          <RotateCcw :size="14" />
          用此策略重新运行
        </button>
      </div>
    </header>

    <section v-if="toast" class="toast" role="status">
      {{ toast }}
    </section>

    <section class="detail-hero">
      <article class="panel run-summary-panel">
        <p class="eyebrow">Decision Topic</p>
        <h1>{{ run.topic }}</h1>
        <p>
          Final Decision 已选择 {{ run.finalDecision.action }}；审计锚点写入 Amoy preview。
          执行记录为 {{ run.executionRecord.status }}，不代表真实 Polymarket 下单。
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
            <p class="eyebrow">Mapped timeline</p>
            <h2>8 阶段推理时间线</h2>
          </div>
          <GitBranch :size="20" class="muted-icon" />
        </div>

        <button
          v-for="stage in run.stages"
          :key="stage.title"
          :class="['timeline-stage', stage.status]"
          type="button"
        >
          <span class="timeline-dot" />
          <span class="timeline-content">
            <strong>{{ stage.title }}</strong>
            <small>{{ stage.domainStates.join(' + ') }}</small>
            <span v-if="stage.status === 'active'" class="timeline-expanded">
              {{ stage.summary }}
            </span>
          </span>
        </button>
      </section>

      <section class="detail-center-column">
        <article class="final-panel">
          <p class="eyebrow">展开阶段 · 最终决策</p>
          <h2>{{ run.finalDecision.action }}</h2>
          <p>{{ run.finalDecision.rationale }}</p>
          <div class="final-chip-row">
            <span>selected {{ run.finalDecision.selectedRecommendationId }}</span>
            <span>veto: {{ run.finalDecision.vetoConditions.length ? run.finalDecision.vetoConditions.join(', ') : 'none' }}</span>
            <span>stake: {{ run.finalDecision.walletActionProposal.stake.amount }} {{ run.finalDecision.walletActionProposal.stake.currency }}</span>
          </div>
        </article>

        <section class="panel evidence-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Evidence citations</p>
              <h2>Agent Evidence Review</h2>
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
              <h2>审计锚点与复制操作</h2>
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
          <p class="eyebrow">Read-only snapshot</p>
          <h2>Strategy Parameters Snapshot</h2>
          <p class="panel-note">
            本次运行使用的是参数快照。修改全局策略不会改变已完成的 Decision Run。
          </p>
          <dl>
            <div><dt>maxStakePerMarket</dt><dd>{{ run.strategyParameters.maxStakePerMarket }}</dd></div>
            <div><dt>dailyRiskBudget</dt><dd>{{ run.strategyParameters.dailyRiskBudget }}</dd></div>
            <div><dt>minimumLiquidity</dt><dd>{{ run.strategyParameters.minimumLiquidity }}</dd></div>
            <div><dt>minimumHoursUntilClose</dt><dd>{{ run.strategyParameters.minimumHoursUntilClose }}</dd></div>
            <div><dt>oneSidedPriceThreshold</dt><dd>{{ run.strategyParameters.oneSidedPriceThreshold }}</dd></div>
            <div><dt>minimumConfidence</dt><dd>{{ run.strategyParameters.minimumConfidence }}</dd></div>
            <div><dt>requiresUserApproval</dt><dd>ON</dd></div>
            <div><dt>executionNetwork</dt><dd>{{ run.strategyParameters.executionNetwork }}</dd></div>
          </dl>
          <div class="snapshot-actions">
            <button type="button" class="secondary-action" @click="showToast('已复制为新策略模板。')">
              复制为新策略
            </button>
            <button type="button" class="secondary-action" @click="showToast('已进入基于快照调整的草稿态；当前 demo 不会保存。')">
              基于快照调整
            </button>
          </div>
        </section>

        <section class="panel execution-panel">
          <p class="eyebrow">Cobo V2 preview</p>
          <h2>User Approval + Execution Record</h2>
          <p class="panel-note">
            用户批准的是拟执行方案。当前记录为 DEFERRED_FOR_MVP；V2 接入 Cobo 后可显示 pact、requestId 和链上交易 hash。
          </p>
          <dl>
            <div><dt>userApproval</dt><dd>approval_1</dd></div>
            <div><dt>executionRecord</dt><dd>{{ run.executionRecord.id }}</dd></div>
            <div><dt>status</dt><dd>{{ run.executionRecord.status }}</dd></div>
            <div><dt>cobo</dt><dd class="tone-preview">V2 preview</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  </main>
</template>
