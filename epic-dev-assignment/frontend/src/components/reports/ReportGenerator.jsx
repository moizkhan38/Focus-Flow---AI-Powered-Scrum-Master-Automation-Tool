import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { formatDate } from '../../utils/utils';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function SummaryCard({ label, value, detail }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{detail}</p>
    </div>
  );
}

export default function ReportGenerator({ report }) {
  const completionRate = report.totalIssues > 0
    ? Math.round((report.completedIssues / report.totalIssues) * 100) : 0;

  const typeData = Object.entries(report.issuesByType || {}).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(report.issuesByPriority || {}).map(([name, value]) => ({ name, value }));
  const assigneeData = Object.entries(report.issuesByAssignee || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Executive Summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Completion Rate" value={`${completionRate}%`} detail={`${report.completedIssues}/${report.totalIssues} issues`} />
          <SummaryCard label="Story Points" value={`${report.completedPoints}/${report.totalPoints}`} detail="completed" />
          <SummaryCard label="Health Score" value={`${report.healthScore?.score}`} detail={report.healthScore?.level} />
          <SummaryCard label="Sprint Period" value={formatDate(report.sprint?.startDate)} detail={`to ${formatDate(report.sprint?.endDate)}`} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {typeData.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Issues by Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {priorityData.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Issues by Priority</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {assigneeData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Issues by Assignee</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={assigneeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
