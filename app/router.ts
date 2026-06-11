import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "./views/DashboardView.vue";
import DecisionRunDetailView from "./views/DecisionRunDetailView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "dashboard", component: DashboardView },
    { path: "/runs/:runId", name: "decision-run", component: DecisionRunDetailView },
  ],
});
