import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function FinanceChart({ data, onClick }) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer>
        <LineChart
          data={data}
          onClick={(e) => {
            if (e && e.activePayload && onClick) {
              const item = e.activePayload[0]?.payload;
              onClick(item);
            }
          }}
        >
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip formatter={(value) => `₱ ${value.toLocaleString()}`} />{" "}
          <Legend />
          {/* ✅ CORE BUSINESS METRICS */}
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-primary)"
            name="Revenue"
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="var(--color-muted)"
            name="Expenses"
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="var(--color-accent)"
            name="Net Profit"
          />
          {/* 🔥 OPTIONAL: CASH FLOW */}
          <Line
            type="monotone"
            dataKey="cashIn"
            stroke="var(--color-primary)"
            name="Cash In"
            strokeDasharray="4 4"
          />
          {/* 🔥 OPTIONAL: DEBT INSIGHT */}
          <Line
            type="monotone"
            dataKey="debtCreated"
            stroke="var(--color-text)"
            name="Debt Created"
            strokeDasharray="2 2"
          />
          <Line
            type="monotone"
            dataKey="debtCollected"
            stroke="var(--color-muted)"
            name="Debt Collected"
            strokeDasharray="2 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
