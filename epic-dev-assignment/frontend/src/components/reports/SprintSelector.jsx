import { formatDate } from '../../utils/utils';

export default function SprintSelector({ sprints, selectedId, onSelect }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Select Sprint</h3>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {sprints.map((sprint) => (
          <button
            key={sprint.id}
            onClick={() => onSelect(sprint.id)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              sprint.id === selectedId ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div>
              <p className="font-medium">{sprint.name}</p>
              <p className="text-xs text-gray-400">
                {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                sprint.state === 'active'
                  ? 'bg-green-100 text-green-700'
                  : sprint.state === 'closed'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-blue-100 text-blue-600'
              }`}
            >
              {sprint.state}
            </span>
          </button>
        ))}
        {sprints.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">No sprints found</p>
        )}
      </div>
    </div>
  );
}
