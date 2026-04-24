import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export default function EditModal({ type, title, description, acceptanceCriteria, testCases, onSave, onClose }) {
  const [formTitle, setFormTitle] = useState(title || '');
  const [formDescription, setFormDescription] = useState(description || '');
  const [formAC, setFormAC] = useState(acceptanceCriteria || '');
  const [formTestCases, setFormTestCases] = useState(testCases || []);

  useEffect(() => {
    setFormTitle(title || '');
    setFormDescription(description || '');
    setFormAC(acceptanceCriteria || '');
    setFormTestCases(testCases || []);
  }, [title, description, acceptanceCriteria, testCases]);

  const handleSave = () => {
    if (!formTitle.trim()) return;
    onSave({
      title: formTitle.trim(),
      description: formDescription.trim(),
      acceptanceCriteria: formAC.trim(),
      ...(type === 'story' && { testCases: formTestCases.filter(tc => tc.trim()) }),
    });
    onClose();
  };

  const updateTestCase = (index, value) => {
    setFormTestCases(prev => prev.map((tc, i) => i === index ? value : tc));
  };

  const addTestCase = () => {
    setFormTestCases(prev => [...prev, '']);
  };

  const removeTestCase = (index) => {
    setFormTestCases(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Edit {type === 'epic' ? 'Epic' : 'Story'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {type === 'story' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Acceptance Criteria</label>
                <textarea
                  value={formAC}
                  onChange={(e) => setFormAC(e.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Test Cases</label>
                  <button
                    type="button"
                    onClick={addTestCase}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formTestCases.map((tc, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <textarea
                        value={tc}
                        onChange={(e) => updateTestCase(i, e.target.value)}
                        rows={2}
                        placeholder={`Test case ${i + 1}`}
                        className="flex-1 resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeTestCase(i)}
                        className="mt-1 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {formTestCases.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No test cases. Click "Add" to create one.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formTitle.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
