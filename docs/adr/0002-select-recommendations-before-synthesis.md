# Select Recommendations Before Synthesis

Final Decisions select one Agent Recommendation instead of synthesizing a new plan from multiple recommendations. The Decision Scorer may still downgrade to `HOLD` when a veto condition appears, because that is a safety outcome rather than a synthesized wallet action. This keeps responsibility and auditability clear while the system is still gathering real Decision Run history; synthesized decisions can be reconsidered later once there is enough performance data to justify making the scorer a strategy-generating participant.
