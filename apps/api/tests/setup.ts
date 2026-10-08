// Tests run against an in-memory analytics DB so real data/ is never touched.
process.env.ANALYTICS_DB = ":memory:";
// Shorter per-carrier latency ceiling keeps the suite fast; adapters honor
// SIM_LATENCY_SCALE by shrinking their simulated sleep.
process.env.SIM_LATENCY_SCALE = "0.15";
